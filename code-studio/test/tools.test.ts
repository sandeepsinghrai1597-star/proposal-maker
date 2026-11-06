import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runTool, safePath, validateInput } from "../src/tools.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "cs-tools-"));
const ctx = { root };

test("safePath blocks escaping the workspace", () => {
  assert.throws(() => safePath(root, "../etc/passwd"));
  assert.throws(() => safePath(root, "/etc/passwd"));
  assert.equal(safePath(root, "a/b.txt"), path.join(root, "a/b.txt"));
});

test("write, read, edit round trip", async () => {
  await runTool("write_file", { path: "src/app.ts", content: "const a = 1;\nconst b = 2;\n" }, ctx);
  const read = await runTool("read_file", { path: "src/app.ts" }, ctx);
  assert.match(read.content, /1\tconst a = 1;/);
  const edit = await runTool(
    "edit_file",
    { path: "src/app.ts", old_string: "const b = 2;", new_string: "const b = 3;", replace_all: false },
    ctx,
  );
  assert.equal(edit.isError, undefined);
  assert.equal(fs.readFileSync(path.join(root, "src/app.ts"), "utf8"), "const a = 1;\nconst b = 3;\n");
});

test("edit_file rejects ambiguous and missing matches", async () => {
  await runTool("write_file", { path: "dup.txt", content: "x\nx\n" }, ctx);
  const ambiguous = await runTool("edit_file", { path: "dup.txt", old_string: "x", new_string: "y", replace_all: false }, ctx);
  assert.equal(ambiguous.isError, true);
  const missing = await runTool("edit_file", { path: "dup.txt", old_string: "zzz", new_string: "y", replace_all: false }, ctx);
  assert.equal(missing.isError, true);
  await runTool("edit_file", { path: "dup.txt", old_string: "x", new_string: "y", replace_all: true }, ctx);
  assert.equal(fs.readFileSync(path.join(root, "dup.txt"), "utf8"), "y\ny\n");
});

test("edit_file keeps dollar patterns literal", async () => {
  const replacement = "`$" + "${x}` $&";
  await runTool("write_file", { path: "d.js", content: "price = 1" }, ctx);
  await runTool("edit_file", { path: "d.js", old_string: "1", new_string: replacement, replace_all: false }, ctx);
  assert.equal(fs.readFileSync(path.join(root, "d.js"), "utf8"), "price = " + replacement);
});

test("run_command returns output and exit code, hides the API key", async () => {
  process.env.ANTHROPIC_API_KEY = "secret-test-key";
  const ok = await runTool("run_command", { command: "echo hi; echo ${ANTHROPIC_API_KEY:-unset}", timeout_seconds: 10 }, ctx);
  assert.match(ok.content, /hi\nunset/);
  const bad = await runTool("run_command", { command: "exit 3", timeout_seconds: 10 }, ctx);
  assert.equal(bad.isError, true);
  assert.match(bad.content, /exit code 3/);
  const slow = await runTool("run_command", { command: "sleep 5", timeout_seconds: 1 }, ctx);
  assert.match(slow.content, /TIMED OUT/);
});

test("search finds matches", async () => {
  const r = await runTool("search", { pattern: "const a", path: ".", ignore_case: false }, ctx);
  assert.match(r.content, /src\/app.ts:1:const a = 1;/);
});

test("validateInput applies defaults and rejects bad input", () => {
  assert.deepEqual(validateInput("list_files", {}), { ok: true, value: { path: ".", depth: 2 } });
  assert.equal(validateInput("write_file", { path: "x" }).ok, false);
  assert.equal(validateInput("nope", {}).ok, false);
});
