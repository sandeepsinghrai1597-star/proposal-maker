/**
 * End-to-end test of the agent loop against a fake Messages API (no real key, no cost).
 * Turn 1: the "model" streams a write_file tool call. Turn 2: it answers with text and ends.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

const requests: any[] = [];

function sse(events: object[]): string {
  return events.map((e: any) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

const usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const start = (id: string) => ({
  type: "message_start",
  message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage },
});

const turn1 = sse([
  start("msg_1"),
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Creating the file." } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "write_file", input: {} } },
  { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"path":"hello.py",' } },
  { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '"content":"print(\\"hi\\")\\n"}' } },
  { type: "content_block_stop", index: 1 },
  { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 200 } },
  { type: "message_stop" },
]);

const turn2 = sse([
  start("msg_2"),
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Done: hello.py created." } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 50 } },
  { type: "message_stop" },
]);

test("agent streams, runs a tool, sends the result back and finishes", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ headers: req.headers, body: JSON.parse(body) });
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(requests.length === 1 ? turn1 : turn2);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cs-agent-"));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.WORKSPACE_DIR = path.join(tmp, "ws");
  process.env.DATA_DIR = path.join(tmp, "data");

  const { runAgent } = await import("../src/agent.js");
  const { createSession, loadSession } = await import("../src/store.js");

  const session = createSession();
  const events: any[] = [];
  await runAgent(session, "make hello.py", { emit: (e) => events.push(e), approve: async () => true });
  server.close();

  // The tool really ran in the workspace.
  assert.equal(fs.readFileSync(path.join(tmp, "ws", "hello.py"), "utf8"), 'print("hi")\n');

  // Request shape: model, adaptive thinking, effort, fallbacks, eager streaming, server tools.
  const first = requests[0].body;
  assert.equal(first.model, "claude-opus-5-5");
  assert.deepEqual(first.thinking, { type: "adaptive", display: "summarized" });
  assert.equal(first.output_config.effort, "high");
  assert.equal(first.fallbacks, "default");
  assert.match(String(requests[0].headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  assert.equal(first.tools.find((t: any) => t.name === "write_file").eager_input_streaming, true);
  assert.ok(first.tools.some((t: any) => t.type === "web_search_20260209"));

  // Turn 2 carries the assistant turn unchanged plus the tool result.
  const second = requests[1].body.messages;
  assert.equal(second.length, 3);
  assert.equal(second[1].role, "assistant");
  assert.equal(second[2].content[0].type, "tool_result");
  assert.equal(second[2].content[0].tool_use_id, "toolu_1");
  assert.match(second[2].content[0].content, /Created hello.py/);

  // Events and persistence.
  assert.ok(events.some((e) => e.type === "tool_result" && !e.isError));
  assert.deepEqual(events.at(-1), { type: "done", stopReason: "end_turn" });
  const saved = loadSession(session.id)!;
  assert.equal(saved.messages.length, 4);
  assert.equal(saved.title, "make hello.py");
  assert.ok(saved.costUsd > 0);

  // A follow-up after an interrupted run stays valid: unanswered tool calls get closed out.
  saved.messages.push({ role: "assistant", content: [{ type: "tool_use", id: "toolu_x", name: "run_command", input: { command: "ls" } }] });
  const { appendUserTextForTest } = await import("../src/agent.js");
  appendUserTextForTest(saved, "continue");
  const last = saved.messages.at(-1)!;
  assert.equal(last.role, "user");
  assert.equal((last.content as any[])[0].type, "tool_result");
  assert.equal((last.content as any[])[1].text, "continue");
});
