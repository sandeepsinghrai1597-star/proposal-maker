/**
 * Free, offline agent loop on a local model served by Ollama (https://ollama.com).
 * Same tools, events and transcript format as the Claude agent, so the UI and storage don't care which runs.
 */
import crypto from "node:crypto";
import { Ollama, type Message, type Tool } from "ollama";
import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { systemPrompt } from "./prompt.js";
import { saveSession, type Session } from "./store.js";
import { NEEDS_APPROVAL, runTool, toolDefinitions, validateInput, type ToolName } from "./tools.js";
import type { RunOptions } from "./agent.js";

type Block = Anthropic.Beta.BetaContentBlockParam;

const ollama = () => new Ollama({ host: config.ollamaHost });

/** Small models get lost in huge tool outputs; keep each result short. */
const LOCAL_RESULT_LIMIT = 8_000;

export async function listLocalModels(): Promise<{ running: boolean; models: string[] }> {
  try {
    const { models } = await ollama().list();
    return { running: true, models: models.map((m) => m.name).sort() };
  } catch {
    return { running: false, models: [] };
  }
}

const localTools: Tool[] = toolDefinitions
  .filter((t): t is Anthropic.Beta.BetaTool => "input_schema" in t)
  .map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema as Tool["function"]["parameters"] },
  }));

function clip(text: string): string {
  return text.length <= LOCAL_RESULT_LIMIT
    ? text
    : `${text.slice(0, LOCAL_RESULT_LIMIT / 2)}\n... [${text.length - LOCAL_RESULT_LIMIT} characters omitted] ...\n${text.slice(-LOCAL_RESULT_LIMIT / 2)}`;
}

/** Convert the stored (Anthropic-shaped) transcript into Ollama chat messages. */
export function toOllamaMessages(messages: Anthropic.Beta.BetaMessageParam[]): Message[] {
  const toolNames = new Map<string, string>();
  const out: Message[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      let content = "";
      const tool_calls: Message["tool_calls"] = [];
      for (const b of m.content as Block[]) {
        if (b.type === "text") content += b.text;
        else if (b.type === "tool_use") {
          toolNames.set(b.id, b.name);
          tool_calls.push({ function: { name: b.name, arguments: (b.input ?? {}) as Record<string, unknown> } });
        }
      }
      out.push({ role: "assistant", content, ...(tool_calls.length ? { tool_calls } : {}) });
    } else {
      const texts: string[] = [];
      for (const b of m.content as Block[]) {
        if (b.type === "tool_result") {
          const text = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => ("text" in c ? c.text : "")).join("\n");
          out.push({ role: "tool", tool_name: toolNames.get(b.tool_use_id) ?? "tool", content: clip(text) });
        } else if (b.type === "text") texts.push(b.text);
      }
      if (texts.length) out.push({ role: "user", content: texts.join("\n\n") });
    }
  }
  return out;
}

/**
 * Keep the conversation inside the local context window: always keep the first user message (the task),
 * then as many of the newest messages as fit. Never start the kept tail on a tool result without its call.
 */
export function fitContext(msgs: Message[], maxChars: number): Message[] {
  const size = (m: Message) => m.content.length + JSON.stringify(m.tool_calls ?? "").length + 20;
  let total = msgs.reduce((n, m) => n + size(m), 0);
  if (total <= maxChars || msgs.length <= 2) return msgs;
  const head = msgs[0];
  let start = 1;
  while (start < msgs.length - 1 && total > maxChars) total -= size(msgs[start++]);
  while (start < msgs.length - 1 && msgs[start].role === "tool") start++;
  return [head, { role: "user", content: "[Earlier steps were trimmed to fit memory. Re-read files if you need details.]" }, ...msgs.slice(start)];
}

export async function runLocalAgent(session: Session, opts: RunOptions): Promise<void> {
  const { emit, signal } = opts;
  const system = systemPrompt({
    workspace: session.workspace,
    date: new Date().toISOString().slice(0, 10),
    githubToken: Boolean(config.githubToken),
    local: true,
  });
  const client = ollama();
  const abort = () => client.abort();
  signal?.addEventListener("abort", abort, { once: true });

  // Rough budget: ~3.5 characters per token, leaving room for the system prompt, tools and the reply.
  const maxChars = Math.max(8_000, Math.floor((config.numCtx - 4_000) * 3.5) - system.length);

  try {
    for (let turn = 1; turn <= config.maxTurns; turn++) {
      if (signal?.aborted) return emit({ type: "done", stopReason: "stopped" });
      emit({ type: "turn_start", turn });

      const messages = [{ role: "system", content: system }, ...fitContext(toOllamaMessages(session.messages), maxChars)];
      let content = "";
      let thinking = "";
      const calls: NonNullable<Message["tool_calls"]> = [];

      try {
        const stream = await client.chat({
          model: session.model,
          messages,
          tools: localTools,
          stream: true,
          think: session.effort === "low" ? false : true,
          options: { num_ctx: config.numCtx },
          keep_alive: "30m",
        });
        for await (const chunk of stream) {
          if (chunk.message.thinking) {
            thinking += chunk.message.thinking;
            emit({ type: "thinking_delta", text: chunk.message.thinking });
          }
          if (chunk.message.content) {
            content += chunk.message.content;
            emit({ type: "text_delta", text: chunk.message.content });
          }
          if (chunk.message.tool_calls?.length) calls.push(...chunk.message.tool_calls);
        }
      } catch (err) {
        if (signal?.aborted) return emit({ type: "done", stopReason: "stopped" });
        const msg = err instanceof Error ? err.message : String(err);
        // Some models reject the think flag; retry once without it.
        if (/does not support thinking/i.test(msg) && session.effort !== "low") {
          session.effort = "low";
          emit({ type: "notice", text: `${session.model} doesn't support thinking, continuing without it.` });
          turn--;
          continue;
        }
        if (/ECONNREFUSED|fetch failed/i.test(msg)) throw new Error(`Ollama is not running at ${config.ollamaHost}. Start the Ollama app (or run "ollama serve").`);
        if (/not found/i.test(msg)) throw new Error(`Model "${session.model}" is not downloaded. Run: ollama pull ${session.model}`);
        if (/does not support tools/i.test(msg)) throw new Error(`"${session.model}" can't use tools. Pick a model with tool support, e.g. mimo-v2.6:9b or qwen2.5-coder:7b.`);
        throw err;
      }

      const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (thinking) blocks.push({ type: "thinking", thinking, signature: "" });
      if (content) blocks.push({ type: "text", text: content });
      const toolUses = calls.map((c) => ({
        type: "tool_use" as const,
        id: `local_${crypto.randomUUID()}`,
        name: c.function.name,
        input: c.function.arguments ?? {},
      }));
      blocks.push(...toolUses);
      if (blocks.length === 0) blocks.push({ type: "text", text: "(no response)" });
      session.messages.push({ role: "assistant", content: blocks });
      saveSession(session);

      if (toolUses.length === 0) return emit({ type: "done", stopReason: "end_turn" });

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emit({ type: "tool_call", id: tu.id, name: tu.name, input: tu.input });
        const v = validateInput(tu.name, tu.input);
        if (!v.ok) {
          const text = `Invalid input for ${tu.name}: ${v.error}. Check the tool's parameters and try again.`;
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: text });
          emit({ type: "tool_result", id: tu.id, name: tu.name, content: text, isError: true });
          continue;
        }
        const name = tu.name as ToolName;
        if (NEEDS_APPROVAL.has(name) && !session.autoApprove) {
          emit({ type: "approval_request", id: tu.id, name, input: v.value });
          if (!(await opts.approve(tu.id, name, v.value))) {
            const text = "The user declined this action. Ask them how to proceed or choose another approach.";
            results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: text });
            emit({ type: "tool_result", id: tu.id, name, content: text, isError: true });
            continue;
          }
        }
        const r = await runTool(name, v.value, { root: session.workspace, signal });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.content, is_error: r.isError || undefined });
        emit({ type: "tool_result", id: tu.id, name, content: r.content, isError: Boolean(r.isError) });
      }
      session.messages.push({ role: "user", content: results });
      saveSession(session);
      emit({ type: "usage", costUsd: 0, sessionCostUsd: session.costUsd });
    }
    emit({ type: "notice", text: `Stopped after ${config.maxTurns} steps. Send "continue" to keep going.` });
    emit({ type: "done", stopReason: "max_turns" });
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
