/**
 * Local (Ollama) agent against a fake Ollama server: no model download needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

const chatBodies: any[] = [];
const line = (o: object) => JSON.stringify({ model: "mimo-v2.6:9b", created_at: new Date().toISOString(), ...o }) + "\n";

const turns = [
  line({ message: { role: "assistant", content: "", thinking: "Need to create the file." }, done: false }) +
    line({ message: { role: "assistant", content: "Bana raha hoon." }, done: false }) +
    line({
      message: {
        role: "assistant",
        content: "",
        tool_calls: [{ function: { name: "write_file", arguments: { path: "app.js", content: "console.log(1)\n" } } }],
      },
      done: false,
    }) +
    line({ message: { role: "assistant", content: "" }, done: true, done_reason: "stop" }),
  line({ message: { role: "assistant", content: "Ho gaya: app.js ban gaya." }, done: false }) +
    line({ message: { role: "assistant", content: "" }, done: true, done_reason: "stop" }),
];

test("local agent runs tools through Ollama and stores an Anthropic-shaped transcript", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/api/tags") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ models: [{ name: "mimo-v2.6:9b" }, { name: "qwen2.5-coder:7b" }] }));
      }
      chatBodies.push(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      res.end(turns[chatBodies.length - 1]);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cs-local-"));
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MODEL;
  process.env.OLLAMA_HOST = `http://127.0.0.1:${port}`;
  process.env.WORKSPACE_DIR = path.join(tmp, "ws");
  process.env.DATA_DIR = path.join(tmp, "data");

  const { config } = await import("../src/config.js");
  const { runAgent } = await import("../src/agent.js");
  const { createSession } = await import("../src/store.js");
  const { listLocalModels } = await import("../src/local-agent.js");

  assert.equal(config.model, "mimo-v2.6:9b", "defaults to a free local model when no API key is set");
  assert.deepEqual(await listLocalModels(), { running: true, models: ["mimo-v2.6:9b", "qwen2.5-coder:7b"] });

  const session = createSession();
  const events: any[] = [];
  await runAgent(session, "app.js banao", { emit: (e) => events.push(e), approve: async () => true });
  server.close();

  assert.equal(fs.readFileSync(path.join(tmp, "ws", "app.js"), "utf8"), "console.log(1)\n");
  assert.equal(chatBodies[0].options.num_ctx, 16384);
  assert.equal(chatBodies[0].messages[0].role, "system");
  assert.ok(chatBodies[0].tools.some((t: any) => t.function.name === "edit_file"));
  // Second request carries the assistant tool call and the tool result.
  const second = chatBodies[1].messages;
  assert.equal(second.at(-2).tool_calls[0].function.name, "write_file");
  assert.equal(second.at(-1).role, "tool");
  assert.equal(second.at(-1).tool_name, "write_file");
  assert.ok(events.some((e) => e.type === "thinking_delta"));
  assert.deepEqual(events.at(-1), { type: "done", stopReason: "end_turn" });
  assert.equal(session.costUsd, 0);
  assert.equal(session.messages.length, 4);
});

test("fitContext keeps the task and the newest steps, never orphans a tool result", async () => {
  const { fitContext } = await import("../src/local-agent.js");
  const big = "x".repeat(1000);
  const msgs = [
    { role: "user", content: "TASK" },
    { role: "assistant", content: big },
    { role: "assistant", content: "", tool_calls: [{ function: { name: "read_file", arguments: {} } }] },
    { role: "tool", content: big },
    { role: "assistant", content: "latest" },
  ];
  const fitted = fitContext(msgs, 1200);
  assert.equal(fitted[0].content, "TASK");
  assert.match(fitted[1].content, /trimmed/);
  assert.notEqual(fitted[2].role, "tool");
  assert.equal(fitted.at(-1)!.content, "latest");
});
