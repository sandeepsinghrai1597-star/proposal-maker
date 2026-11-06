import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

/** Every tool result is truncated to this many characters so one huge output can't flood context. */
const MAX_OUTPUT = 30_000;

function clip(text: string, limit = MAX_OUTPUT): string {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return `${text.slice(0, half)}\n\n... [${text.length - limit} characters omitted] ...\n\n${text.slice(-half)}`;
}

/** Resolve a model-supplied path and refuse anything outside the workspace. */
export function safePath(root: string, p: string): string {
  const resolved = path.resolve(root, p);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path "${p}" is outside the workspace. Use paths relative to the workspace root.`);
  }
  return resolved;
}

const IGNORED_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "__pycache__", ".venv", "venv", ".cache"]);

// ---------- input schemas (validated before every run: eager input streaming skips server validation) ----------

const schemas = {
  list_files: z.object({ path: z.string().default("."), depth: z.number().int().min(1).max(6).default(2) }),
  read_file: z.object({
    path: z.string(),
    start_line: z.number().int().min(1).optional(),
    end_line: z.number().int().min(1).optional(),
  }),
  write_file: z.object({ path: z.string(), content: z.string() }),
  edit_file: z.object({
    path: z.string(),
    old_string: z.string().min(1),
    new_string: z.string(),
    replace_all: z.boolean().default(false),
  }),
  search: z.object({
    pattern: z.string().min(1),
    path: z.string().default("."),
    glob: z.string().optional(),
    ignore_case: z.boolean().default(false),
  }),
  run_command: z.object({
    command: z.string().min(1),
    timeout_seconds: z.number().int().min(1).max(1800).default(120),
  }),
  delete_path: z.object({ path: z.string() }),
};

export type ToolName = keyof typeof schemas;

/** Tools that change things outside a single file write: they need approval unless auto-approve is on. */
export const NEEDS_APPROVAL: ReadonlySet<ToolName> = new Set(["run_command", "delete_path"]);

// ---------- tool definitions sent to the API ----------

export const toolDefinitions: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "list_files",
    description:
      "List files and folders in the workspace as a tree. Skips .git, node_modules and build folders. Use it first to understand an unfamiliar project.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Folder relative to the workspace root. Default '.'" },
        depth: { type: "integer", description: "How many levels deep, 1-6. Default 2." },
      },
    },
  },
  {
    name: "read_file",
    description:
      "Read a text file with line numbers. For big files pass start_line/end_line. Always read a file before editing it.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        start_line: { type: "integer" },
        end_line: { type: "integer" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a new file or fully replace an existing one. Parent folders are created. Prefer edit_file for small changes to existing files.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "The complete file contents." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace an exact string in a file. old_string must match the file exactly (including indentation) and be unique unless replace_all is true. Include a few surrounding lines to make it unique.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "search",
    description:
      "Search file contents with a regular expression (ripgrep). Returns matching lines as path:line:text. Use glob like '*.ts' to filter.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        glob: { type: "string" },
        ignore_case: { type: "boolean" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command (bash) in the workspace root: install packages, run tests, builds, linters, scripts, git. Output (stdout+stderr) and exit code are returned. Not interactive: never run commands that wait for input or never exit (dev servers, watchers) unless you add a timeout. Use non-interactive flags (-y, --yes).",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeout_seconds: { type: "integer", description: "Default 120, max 1800." },
      },
      required: ["command"],
    },
  },
  {
    name: "delete_path",
    description: "Delete a file or folder inside the workspace.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
];

// ---------- implementations ----------

async function tree(dir: string, depth: number, prefix = ""): Promise<string[]> {
  const entries = (await fs.readdir(dir, { withFileTypes: true }))
    .filter((e) => !IGNORED_DIRS.has(e.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  const lines: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      lines.push(`${prefix}${e.name}/`);
      if (depth > 1) lines.push(...(await tree(path.join(dir, e.name), depth - 1, prefix + "  ")));
    } else {
      lines.push(`${prefix}${e.name}`);
    }
    if (lines.length > 1500) break;
  }
  return lines;
}

export function runShell(
  command: string,
  cwd: string,
  timeoutSeconds: number,
  signal?: AbortSignal,
): Promise<{ output: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, CI: "1", GIT_TERMINAL_PROMPT: "0" };
    // Keep the Anthropic key out of child processes the model starts.
    delete env.ANTHROPIC_API_KEY;
    const child = spawn("bash", ["-lc", command], { cwd, env, detached: process.platform !== "win32" });
    let output = "";
    let timedOut = false;
    const onData = (d: Buffer) => {
      output += d.toString();
      if (output.length > MAX_OUTPUT * 4) output = output.slice(-MAX_OUTPUT * 2);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const kill = () => {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutSeconds * 1000);
    signal?.addEventListener("abort", kill, { once: true });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ output, code, timedOut });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ output: output + String(err), code: -1, timedOut });
    });
  });
}

export interface ToolContext {
  root: string;
  signal?: AbortSignal;
}

type Result = { content: string; isError?: boolean };

const impl: { [K in ToolName]: (input: z.infer<(typeof schemas)[K]>, ctx: ToolContext) => Promise<Result> } = {
  async list_files({ path: p, depth }, { root }) {
    const dir = safePath(root, p);
    const lines = await tree(dir, depth);
    return { content: lines.length ? lines.join("\n") : "(empty folder)" };
  },

  async read_file({ path: p, start_line, end_line }, { root }) {
    const file = safePath(root, p);
    const buf = await fs.readFile(file);
    if (buf.subarray(0, 8000).includes(0)) return { content: `${p} looks like a binary file (${buf.length} bytes).` };
    const lines = buf.toString("utf8").split("\n");
    const start = (start_line ?? 1) - 1;
    const end = Math.min(end_line ?? lines.length, lines.length);
    const numbered = lines.slice(start, end).map((l, i) => `${String(start + i + 1).padStart(5)}\t${l}`);
    const header = `${p} (${lines.length} lines)${start_line || end_line ? `, showing ${start + 1}-${end}` : ""}\n`;
    return { content: clip(header + numbered.join("\n"), 60_000) };
  },

  async write_file({ path: p, content }, { root }) {
    const file = safePath(root, p);
    const existed = existsSync(file);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    return { content: `${existed ? "Updated" : "Created"} ${p} (${content.split("\n").length} lines).` };
  },

  async edit_file({ path: p, old_string, new_string, replace_all }, { root }) {
    const file = safePath(root, p);
    const text = await fs.readFile(file, "utf8");
    const count = text.split(old_string).length - 1;
    if (count === 0) {
      return { isError: true, content: `old_string not found in ${p}. Read the file again and copy the text exactly.` };
    }
    if (count > 1 && !replace_all) {
      return {
        isError: true,
        content: `old_string appears ${count} times in ${p}. Add surrounding lines to make it unique, or set replace_all.`,
      };
    }
    const updated = replace_all ? text.split(old_string).join(new_string) : text.replace(old_string, () => new_string);
    await fs.writeFile(file, updated);
    return { content: `Edited ${p} (${count} replacement${count > 1 ? "s" : ""}).` };
  },

  async search({ pattern, path: p, glob, ignore_case }, { root, signal }) {
    const dir = safePath(root, p);
    const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    const cmd = [
      "rg --line-number --no-heading --color never --max-columns 300 --max-count 50",
      ignore_case ? "-i" : "",
      glob ? `--glob ${q(glob)}` : "",
      "-e",
      q(pattern),
      q(dir),
    ].join(" ");
    const { output, code } = await runShell(cmd, root, 60, signal);
    if (code === 1) return { content: "No matches." };
    const rel = output.split(root + path.sep).join("");
    return { content: clip(rel || "No matches."), isError: code !== 0 && code !== 1 };
  },

  async run_command({ command, timeout_seconds }, { root, signal }) {
    const { output, code, timedOut } = await runShell(command, root, timeout_seconds, signal);
    const status = timedOut ? `TIMED OUT after ${timeout_seconds}s` : `exit code ${code}`;
    return { content: `${clip(output.trim() || "(no output)")}\n\n[${status}]`, isError: timedOut || code !== 0 };
  },

  async delete_path({ path: p }, { root }) {
    const target = safePath(root, p);
    if (target === root) return { isError: true, content: "Refusing to delete the workspace root." };
    await fs.rm(target, { recursive: true, force: true });
    return { content: `Deleted ${p}.` };
  },
};

export function isToolName(name: string): name is ToolName {
  return name in schemas;
}

/** Validate input against the tool's schema; returns an error message instead of throwing. */
export function validateInput(name: string, input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!isToolName(name)) return { ok: false, error: `Unknown tool: ${name}` };
  const parsed = schemas[name].safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, value: parsed.data };
}

export async function runTool(name: ToolName, input: unknown, ctx: ToolContext): Promise<Result> {
  try {
    // input was validated by validateInput; the cast restores the per-tool type.
    return await (impl[name] as (i: unknown, c: ToolContext) => Promise<Result>)(input, ctx);
  } catch (err) {
    return { isError: true, content: err instanceof Error ? err.message : String(err) };
  }
}
