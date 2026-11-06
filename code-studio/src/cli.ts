/**
 * Terminal version of Code Studio: same agent, chat in your terminal.
 *   npm run cli                 new chat in WORKSPACE_DIR
 *   npm run cli -- my-app       new chat in WORKSPACE_DIR/my-app
 *   npm run cli -- --yes        run commands without asking
 */
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "./config.js";
import { runAgent } from "./agent.js";
import { createSession } from "./store.js";
import { safePath } from "./tools.js";

const args = process.argv.slice(2);
const autoApprove = args.includes("--yes");
const folder = args.find((a) => !a.startsWith("--"));
const workspace = folder ? safePath(config.workspace, folder) : config.workspace;

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const rl = readline.createInterface({ input: stdin, output: stdout });
const session = createSession({ workspace, autoApprove });
console.log(`Code Studio CLI  ·  ${session.model} (${session.effort})  ·  ${workspace}`);
console.log(dim('Type your request. "exit" to quit. Ctrl+C stops the current task.\n'));

let controller: AbortController | null = null;
process.on("SIGINT", () => {
  if (controller) {
    controller.abort();
    console.log(red("\n[stopping...]"));
  } else process.exit(0);
});

for (;;) {
  const text = (await rl.question(cyan("\nyou › "))).trim();
  if (!text) continue;
  if (text === "exit" || text === "quit") break;
  controller = new AbortController();
  let inThinking = false;
  try {
    await runAgent(session, text, {
      signal: controller.signal,
      approve: async (_id, name, input) => {
        const detail = name === "run_command" ? (input as { command: string }).command : JSON.stringify(input);
        const a = (await rl.question(`\n${red("approve")} ${name}: ${detail}  [y/N/a=always] `)).trim().toLowerCase();
        if (a === "a") session.autoApprove = true;
        return a === "y" || a === "a";
      },
      emit: (e) => {
        if (e.type === "thinking_delta") {
          if (!inThinking) stdout.write(dim("\n[thinking] "));
          inThinking = true;
          stdout.write(dim(e.text));
          return;
        }
        if (inThinking && e.type !== "turn_start") {
          inThinking = false;
          stdout.write("\n");
        }
        switch (e.type) {
          case "text_delta":
            stdout.write(e.text);
            break;
          case "tool_call": {
            const i = e.input as Record<string, unknown>;
            const detail = (i.command ?? i.path ?? i.pattern ?? "") as string;
            stdout.write(cyan(`\n● ${e.name} `) + dim(String(detail).slice(0, 200)) + "\n");
            break;
          }
          case "tool_result":
            stdout.write(dim(e.content.split("\n").slice(0, 6).join("\n").slice(0, 600)) + (e.isError ? red(" ✗") : "") + "\n");
            break;
          case "server_tool":
            stdout.write(cyan(`\n● ${e.name}\n`));
            break;
          case "notice":
            stdout.write(red(`\n[${e.text}]\n`));
            break;
          case "usage":
            break;
          case "done":
            stdout.write(dim(`\n\n[${e.stopReason} · chat cost $${session.costUsd.toFixed(3)}]\n`));
            break;
        }
      },
    });
  } catch (err) {
    console.log(red(`\nError: ${err instanceof Error ? err.message : String(err)}`));
  }
  controller = null;
}
rl.close();
