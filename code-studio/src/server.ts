import express, { type Request, type Response, type NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { config, CLAUDE_MODELS, EFFORT_LEVELS, isLocalModel, isValidModel, type Effort } from "./config.js";
import { listLocalModels } from "./local-agent.js";
import { runAgent, type AgentEvent } from "./agent.js";
import { createSession, deleteSession, listSessions, loadSession, saveSession, type Session } from "./store.js";
import { runShell, safePath } from "./tools.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------- optional password (HTTP Basic auth, any username) ----------
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!config.appPassword) return next();
  const header = req.headers.authorization ?? "";
  const given = header.startsWith("Basic ") ? Buffer.from(header.slice(6), "base64").toString().split(":").slice(1).join(":") : "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(config.appPassword).digest();
  if (crypto.timingSafeEqual(a, b)) return next();
  res.set("WWW-Authenticate", 'Basic realm="Code Studio"').status(401).send("Password required");
});

app.use(express.static(path.join(here, "..", "public")));

// ---------- live runs: one per session, events buffered so a reconnecting browser can replay ----------
interface Run {
  events: AgentEvent[];
  listeners: Set<(e: AgentEvent) => void>;
  approvals: Map<string, (ok: boolean) => void>;
  controller: AbortController;
  done: boolean;
  /** The in-memory session the agent is mutating; edits during a run must go here, not to disk. */
  session: Session;
}
const runs = new Map<string, Run>();

function liveSession(id: string): Session | null {
  const run = runs.get(id);
  return run && !run.done ? run.session : loadSession(id);
}

function publicSession(s: Session) {
  const run = runs.get(s.id);
  return { ...s, running: Boolean(run && !run.done) };
}

function getSession(req: Request, res: Response): Session | null {
  const s = liveSession(req.params.id);
  if (!s) res.status(404).json({ error: "Chat not found" });
  return s;
}

/** Workspaces must stay inside WORKSPACE_DIR. */
function resolveWorkspace(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) return config.workspace;
  const p = safePath(config.workspace, input.trim());
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error(`Folder not found: ${input}`);
  return p;
}

app.get("/api/config", async (_req, res) => {
  const local = await listLocalModels();
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  res.json({
    models: [...local.models, ...(hasKey ? CLAUDE_MODELS : [])],
    ollamaRunning: local.running,
    efforts: EFFORT_LEVELS,
    model: config.model,
    effort: config.effort,
    workspaceRoot: config.workspace,
    hasApiKey: hasKey,
    hasGithubToken: Boolean(config.githubToken),
    maxTaskUsd: config.maxTaskUsd,
  });
});

app.get("/api/folders", (_req, res) => {
  const folders = fs
    .readdirSync(config.workspace, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
  res.json({ folders });
});

app.post("/api/clone", async (req, res) => {
  const repo = String(req.body?.repo ?? "").trim();
  const m = repo.match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) return res.status(400).json({ error: "Use owner/repo or https://github.com/owner/repo" });
  const [, owner, name] = m;
  const target = path.join(config.workspace, name);
  if (fs.existsSync(target)) return res.json({ folder: name, existed: true });
  const auth = config.githubToken ? `x-access-token:${config.githubToken}@` : "";
  const r = await runShell(`git clone https://${auth}github.com/${owner}/${name}.git ${JSON.stringify(name)}`, config.workspace, 300);
  if (r.code !== 0) {
    const msg = r.output.split(config.githubToken || "\u0000").join("***");
    return res.status(400).json({ error: `git clone failed: ${msg.trim()}` });
  }
  res.json({ folder: name, existed: false });
});

app.get("/api/sessions", (_req, res) => res.json({ sessions: listSessions() }));

app.post("/api/sessions", (req, res) => {
  try {
    const { model, effort, workspace } = req.body ?? {};
    const s = createSession({
      model: isValidModel(model) ? model : config.model,
      effort: EFFORT_LEVELS.includes(effort) ? (effort as Effort) : config.effort,
      workspace: resolveWorkspace(workspace),
    });
    res.json(publicSession(s));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/sessions/:id", (req, res) => {
  const s = getSession(req, res);
  if (s) res.json(publicSession(s));
});

app.patch("/api/sessions/:id", (req, res) => {
  const s = getSession(req, res);
  if (!s) return;
  const { model, effort, autoApprove, title } = req.body ?? {};
  // Changing the model mid-chat is allowed; thinking blocks from the old model are simply ignored by the API.
  if (isValidModel(model)) s.model = model;
  if (EFFORT_LEVELS.includes(effort)) s.effort = effort;
  if (typeof autoApprove === "boolean") s.autoApprove = autoApprove;
  if (typeof title === "string" && title.trim()) s.title = title.trim().slice(0, 100);
  saveSession(s);
  res.json(publicSession(s));
});

app.delete("/api/sessions/:id", (req, res) => {
  runs.get(req.params.id)?.controller.abort();
  deleteSession(req.params.id);
  res.json({ ok: true });
});

app.post("/api/sessions/:id/messages", (req, res) => {
  const s = getSession(req, res);
  if (!s) return;
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "Empty message" });
  const existing = runs.get(s.id);
  if (existing && !existing.done) return res.status(409).json({ error: "This chat is still working. Stop it or wait." });

  const run: Run = { events: [], listeners: new Set(), approvals: new Map(), controller: new AbortController(), done: false, session: s };
  runs.set(s.id, run);
  const emit = (e: AgentEvent) => {
    run.events.push(e);
    for (const l of run.listeners) l(e);
  };

  runAgent(s, text, {
    emit,
    signal: run.controller.signal,
    approve: (id) =>
      new Promise<boolean>((resolve) => {
        run.approvals.set(id, resolve);
        run.controller.signal.addEventListener("abort", () => resolve(false), { once: true });
      }),
  })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "error", message });
      emit({ type: "done", stopReason: "error" });
    })
    .finally(() => {
      run.done = true;
      for (const l of run.listeners) l({ type: "done", stopReason: "closed" });
    });

  res.status(202).json({ ok: true });
});

/** Server-sent events for the current (or last) run of a chat. Replays buffered events first. */
app.get("/api/sessions/:id/events", (req, res) => {
  const run = runs.get(req.params.id);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (e: AgentEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  if (!run) {
    send({ type: "done", stopReason: "idle" });
    return res.end();
  }
  run.events.forEach(send);
  if (run.done) return res.end();
  const listener = (e: AgentEvent) => {
    send(e);
    if (e.type === "done" && run.done) res.end();
  };
  run.listeners.add(listener);
  const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
  req.on("close", () => {
    clearInterval(ping);
    run.listeners.delete(listener);
  });
});

app.post("/api/sessions/:id/approve", (req, res) => {
  const run = runs.get(req.params.id);
  const { toolId, approve, always } = req.body ?? {};
  const resolve = run?.approvals.get(toolId);
  if (!resolve) return res.status(404).json({ error: "Nothing waiting for approval" });
  if (always) {
    const s = liveSession(req.params.id);
    if (s) {
      s.autoApprove = true;
      saveSession(s);
    }
  }
  run!.approvals.delete(toolId);
  resolve(Boolean(approve));
  res.json({ ok: true });
});

app.post("/api/sessions/:id/stop", (req, res) => {
  runs.get(req.params.id)?.controller.abort();
  res.json({ ok: true });
});

app.listen(config.port, config.host, () => {
  const url = `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}`;
  console.log(`\n  Code Studio is running: ${url}`);
  console.log(`  Model: ${config.model} (effort ${config.effort})   Workspace: ${config.workspace}`);
  if (isLocalModel(config.model)) {
    console.log(`  Local mode (free): needs Ollama running at ${config.ollamaHost} and "ollama pull ${config.model}" done once.`);
  } else if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.log("  WARNING: ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
  }
  if (config.host !== "127.0.0.1" && !config.appPassword) {
    console.log("  WARNING: listening on a public interface without APP_PASSWORD. Anyone who reaches it can run commands.");
  }
  console.log("");
});
