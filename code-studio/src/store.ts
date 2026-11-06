import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { config, type Effort } from "./config.js";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  effort: Effort;
  /** Absolute path of the folder this chat works in. */
  workspace: string;
  /** When true, commands run without asking. */
  autoApprove: boolean;
  /** Full API transcript, append-only (assistant turns stored exactly as returned). */
  messages: Anthropic.Beta.BetaMessageParam[];
  costUsd: number;
}

const dir = () => path.join(config.dataDir, "sessions");
const file = (id: string) => path.join(dir(), `${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);

export function createSession(partial: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  const s: Session = {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    model: config.model,
    effort: config.effort,
    workspace: config.workspace,
    autoApprove: false,
    messages: [],
    costUsd: 0,
    ...partial,
  };
  saveSession(s);
  return s;
}

export function saveSession(s: Session): void {
  s.updatedAt = new Date().toISOString();
  const tmp = file(s.id) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s));
  fs.renameSync(tmp, file(s.id));
}

export function loadSession(id: string): Session | null {
  try {
    return JSON.parse(fs.readFileSync(file(id), "utf8")) as Session;
  } catch {
    return null;
  }
}

export function deleteSession(id: string): void {
  fs.rmSync(file(id), { force: true });
}

export function listSessions(): Array<Pick<Session, "id" | "title" | "updatedAt" | "costUsd">> {
  return fs
    .readdirSync(dir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadSession(f.slice(0, -5)))
    .filter((s): s is Session => s !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, title, updatedAt, costUsd }) => ({ id, title, updatedAt, costUsd }));
}
