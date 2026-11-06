import Anthropic from "@anthropic-ai/sdk";
import { config, costUsd } from "./config.js";
import { systemPrompt } from "./prompt.js";
import { saveSession, type Session } from "./store.js";
import { NEEDS_APPROVAL, runTool, toolDefinitions, validateInput, type ToolName } from "./tools.js";

/** Events streamed to the UI (web or CLI). */
export type AgentEvent =
  | { type: "turn_start"; turn: number }
  | { type: "thinking_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_input_delta"; id: string; partial: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; content: string; isError: boolean }
  | { type: "server_tool"; name: string; detail: string }
  | { type: "approval_request"; id: string; name: string; input: unknown }
  | { type: "usage"; costUsd: number; sessionCostUsd: number }
  | { type: "notice"; text: string }
  | { type: "done"; stopReason: string }
  | { type: "error"; message: string };

export interface RunOptions {
  emit: (e: AgentEvent) => void;
  /** Resolves true to run the tool, false to skip it. Only called when autoApprove is off. */
  approve: (id: string, name: string, input: unknown) => Promise<boolean>;
  signal?: AbortSignal;
}

const client = new Anthropic({ maxRetries: 4 });

const SERVER_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
];

function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 57) + "..." : t || "New chat";
}

/**
 * Add the user's text as the next user turn. If the previous run was interrupted, the transcript may end
 * with unanswered tool calls or with unsent tool results; this closes those out so the request stays valid.
 */
function appendUserText(session: Session, text: string): void {
  const msgs = session.messages;
  const last = msgs[msgs.length - 1];
  if (last?.role === "assistant" && Array.isArray(last.content)) {
    const pending = last.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (pending.length) {
      msgs.push({
        role: "user",
        content: [
          ...pending.map((tu) => ({
            type: "tool_result" as const,
            tool_use_id: tu.id,
            is_error: true,
            content: "Interrupted by the user before this ran.",
          })),
          { type: "text" as const, text },
        ],
      });
      return;
    }
  }
  if (last?.role === "user") {
    // Never-answered user turn (stopped run): extend it rather than sending two user turns in a row.
    const blocks = typeof last.content === "string" ? [{ type: "text" as const, text: last.content }] : last.content;
    last.content = [...blocks, { type: "text" as const, text }];
    return;
  }
  msgs.push({ role: "user", content: text });
}

/**
 * Run one user message to completion: stream the model, execute tools, loop until the model ends its turn.
 * The transcript is append-only (assistant content is stored exactly as returned), which keeps prompt
 * caching effective and thinking blocks valid across turns.
 */
export async function runAgent(session: Session, userText: string, opts: RunOptions): Promise<void> {
  const { emit, signal } = opts;
  if (session.messages.length === 0) session.title = titleFrom(userText);
  appendUserText(session, userText);
  saveSession(session);

  const system = systemPrompt({
    workspace: session.workspace,
    date: new Date().toISOString().slice(0, 10),
    githubToken: Boolean(config.githubToken),
  });

  let taskCost = 0;
  let jsonRetries = 0;

  for (let turn = 1; turn <= config.maxTurns; turn++) {
    if (signal?.aborted) return emit({ type: "done", stopReason: "stopped" });
    emit({ type: "turn_start", turn });

    const stream = client.beta.messages.stream(
      {
        model: session.model,
        max_tokens: 64000,
        system,
        tools: [...toolDefinitions, ...SERVER_TOOLS],
        messages: session.messages,
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: session.effort },
        cache_control: { type: "ephemeral" },
        // Server-side fallback: if a safety classifier declines, the API re-runs on a suitable model.
        fallbacks: "default",
        betas: ["server-side-fallback-2026-07-01"],
      },
      { signal },
    );

    const toolNames = new Map<number, { id: string; name: string }>();
    let message: Anthropic.Beta.BetaMessage;
    try {
      for await (const ev of stream) {
        if (ev.type === "content_block_start") {
          const b = ev.content_block;
          if (b.type === "tool_use") {
            toolNames.set(ev.index, { id: b.id, name: b.name });
            emit({ type: "tool_start", id: b.id, name: b.name });
          } else if (b.type === "server_tool_use") {
            emit({ type: "server_tool", name: b.name, detail: "" });
          }
        } else if (ev.type === "content_block_delta") {
          const d = ev.delta;
          if (d.type === "text_delta") emit({ type: "text_delta", text: d.text });
          else if (d.type === "thinking_delta") emit({ type: "thinking_delta", text: d.thinking });
          else if (d.type === "input_json_delta") {
            const t = toolNames.get(ev.index);
            if (t) emit({ type: "tool_input_delta", id: t.id, partial: d.partial_json });
          }
        }
      }
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (signal?.aborted) return emit({ type: "done", stopReason: "stopped" });
      // With eager input streaming the SDK rejects when a tool input isn't parseable JSON: re-issue the turn.
      if (!(err instanceof Anthropic.APIError) && jsonRetries++ < 2) {
        emit({ type: "notice", text: "Tool input was malformed, retrying this step..." });
        continue;
      }
      throw err;
    }

    const cost = costUsd(session.model, message.usage);
    taskCost += cost;
    session.costUsd += cost;
    emit({ type: "usage", costUsd: taskCost, sessionCostUsd: session.costUsd });

    for (const b of message.content) {
      if (b.type === "fallback") emit({ type: "notice", text: `Request was re-run on ${b.to.model} by the API's safety fallback.` });
    }

    const stop = message.stop_reason ?? "end_turn";
    if (stop === "refusal") {
      saveSession(session);
      return emit({ type: "done", stopReason: "refusal" });
    }

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    session.messages.push({ role: "assistant", content: message.content });

    if (stop === "max_tokens" && toolUses.length > 0) {
      // A cut-off tool input can still parse, so never run it. Answer each call with an error (append-only).
      emit({ type: "notice", text: "Output limit reached mid tool call, asking the model to work in smaller pieces." });
      session.messages.push({
        role: "user",
        content: toolUses.map((tu) => ({
          type: "tool_result" as const,
          tool_use_id: tu.id,
          is_error: true,
          content: "Not executed: this tool call was cut off by the output limit. Split large files into several smaller writes or use edit_file, then continue.",
        })),
      });
      saveSession(session);
      continue;
    }
    saveSession(session);

    if (stop === "pause_turn") continue; // server tool loop paused; resend to continue
    if (toolUses.length === 0) return emit({ type: "done", stopReason: stop });

    // Run all tool calls from this turn, then send every result back in one user message.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      emit({ type: "tool_call", id: tu.id, name: tu.name, input: tu.input });
      const v = validateInput(tu.name, tu.input);
      if (!v.ok) {
        const content = JSON.stringify({ INVALID_INPUT: v.error, received: tu.input });
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content });
        emit({ type: "tool_result", id: tu.id, name: tu.name, content, isError: true });
        continue;
      }
      const name = tu.name as ToolName;
      if (NEEDS_APPROVAL.has(name) && !session.autoApprove) {
        emit({ type: "approval_request", id: tu.id, name, input: v.value });
        const ok = await opts.approve(tu.id, name, v.value);
        if (!ok) {
          const content = "The user declined this action. Ask them how to proceed or choose another approach.";
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content });
          emit({ type: "tool_result", id: tu.id, name, content, isError: true });
          continue;
        }
      }
      const r = await runTool(name, v.value, { root: session.workspace, signal });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: r.content, is_error: r.isError || undefined });
      emit({ type: "tool_result", id: tu.id, name, content: r.content, isError: Boolean(r.isError) });
    }
    session.messages.push({ role: "user", content: results });
    saveSession(session);

    if (signal?.aborted) return emit({ type: "done", stopReason: "stopped" });
    if (taskCost > config.maxTaskUsd) {
      // The transcript ends on tool results, so the next user message continues the same task cleanly.
      emit({
        type: "notice",
        text: `Paused: this task has cost $${taskCost.toFixed(2)} (limit MAX_TASK_USD=$${config.maxTaskUsd}). Send "continue" to keep going.`,
      });
      return emit({ type: "done", stopReason: "budget" });
    }
  }
  emit({ type: "notice", text: `Stopped after ${config.maxTurns} steps. Send "continue" to keep going.` });
  emit({ type: "done", stopReason: "max_turns" });
}

/** Exported for tests only. */
export const appendUserTextForTest = appendUserText;
