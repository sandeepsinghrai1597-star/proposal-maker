import fs from "node:fs";
import path from "node:path";

/** Minimal .env loader (no dependency). Real environment variables win over the file. */
function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(path.resolve(".env"));

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

function effortFrom(value: string | undefined): Effort {
  return EFFORTS.includes(value as Effort) ? (value as Effort) : "high";
}

export const config = {
  /** "claude-*" models use the Anthropic API; any other name is a local Ollama model. */
  model:
    process.env.MODEL ||
    (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? "claude-opus-5-5" : "mimo-v2.6:9b"),
  effort: effortFrom(process.env.EFFORT),
  workspace: path.resolve(process.env.WORKSPACE_DIR || "./workspace"),
  dataDir: path.resolve(process.env.DATA_DIR || "./data"),
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  appPassword: process.env.APP_PASSWORD || "",
  githubToken: process.env.GITHUB_TOKEN || "",
  maxTaskUsd: Number(process.env.MAX_TASK_USD || 3),
  ollamaHost: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
  /** Context window for local models. Ollama's default (4k on small machines) is too small for coding agents. */
  numCtx: Number(process.env.NUM_CTX || 16384),
  /** Hard cap on agent turns per user message, a guard against runaway loops. */
  maxTurns: Number(process.env.MAX_TURNS || 80),
};

export const EFFORT_LEVELS = EFFORTS;

/** USD per million tokens: [input, output, cache read, cache write 5m]. */
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-sonnet-5-5": [2, 10, 0.2, 2.5],
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125],
  "claude-fable-5-1": [10, 50, 0.25, 12.5],
};

export const CLAUDE_MODELS = Object.keys(PRICES);

export function isLocalModel(model: string): boolean {
  return !model.startsWith("claude-");
}

/** Accept any Claude model we price, or any plausible Ollama model name like "qwen2.5-coder:7b". */
export function isValidModel(model: unknown): model is string {
  return typeof model === "string" && (CLAUDE_MODELS.includes(model) || /^[a-zA-Z0-9][\w.\-/]*(:[\w.\-]+)?$/.test(model));
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: Usage): number {
  if (isLocalModel(model)) return 0;
  const [inp, out, read, write] = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (
    (u.input_tokens * inp +
      u.output_tokens * out +
      (u.cache_read_input_tokens ?? 0) * read +
      (u.cache_creation_input_tokens ?? 0) * write) /
    1_000_000
  );
}

fs.mkdirSync(config.workspace, { recursive: true });
fs.mkdirSync(path.join(config.dataDir, "sessions"), { recursive: true });
