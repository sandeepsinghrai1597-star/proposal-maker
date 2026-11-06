# Code Studio: aapka apna AI coding agent

Chat karo, code ban jaata hai. Code Studio ek chat app hai jo **Claude Opus 5.5** (Anthropic ka current Opus model) ko aapke project folder ke andar kaam karne deta hai. Ye code padhta hai, files likhta aur edit karta hai, commands chalata hai, tests run karta hai aur GitHub pe push karta hai.

> Honest note: ye Opus 5.5 ki "copy" nahi hai. Itna bada model ghar pe train karna possible nahi hai. Ye asli Opus 5.5 ko API se use karta hai, aur uske chaaron taraf ek **coding agent** (tools + loop + safety) banata hai. Isliye code quality wahi milti hai jo Opus 5.5 ki hai.

## Kya-kya kar sakta hai
- Hindi, Hinglish ya English mein chat karo ("ek React todo app banao", "is bug ko fix karo")
- Project padhta hai (`list_files`, `read_file`, `search`), phir code likhta hai (`write_file`, `edit_file`)
- Khud verify karta hai: `npm install`, build, tests, linters (`run_command`)
- Naye docs ke liye web search aur web fetch karta hai
- GitHub repo clone karta hai, commit aur push karta hai
- Har command chalane se pehle permission maangta hai (ya "auto-run" on karo)
- Har chat ka cost dikhata hai, aur ek task ka cost `MAX_TASK_USD` se upar jaaye to ruk jaata hai
- Web UI (laptop + phone) aur terminal CLI, dono

## Setup (5 minute)
Zaroori: **Node.js 20+** aur **git**. ([nodejs.org](https://nodejs.org) se Node install karo)

```bash
git clone https://github.com/sandeepsinghrai1597-star/proposal-maker.git
cd proposal-maker/code-studio
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

`.env` kholo aur kam se kam ye bharo:
```
ANTHROPIC_API_KEY=sk-ant-...      # https://console.anthropic.com/settings/keys
GITHUB_TOKEN=ghp_...              # optional: private repo clone + push ke liye
```
GitHub token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → apni repos select karo → "Contents: Read and write".

Chalao:
```bash
npm start
```
Browser mein kholo: **http://127.0.0.1:3000**

Terminal mein chat karni ho to:
```bash
npm run cli                 # workspace/ folder mein
npm run cli -- my-app       # workspace/my-app mein
```

## Kaise use karein
1. **Apna GitHub repo kholo:** sidebar mein `owner/repo` likho, "Clone" dabao. Ye `workspace/<repo>` mein aa jaayega aur naye chats usi mein kaam karenge.
2. **Naya project:** "workspace (root)" chuno aur likho: *"my-app folder mein Next.js + Tailwind landing page banao aur build check karo"*.
3. Agent jo bhi command chalayega, pehle aapse poochega. **Run**, **Always run (this chat)** ya **Skip** dabao.
4. Kaam ho jaane ke baad bolo: *"changes commit karke push karo"*.

**Behtar results ke liye tips**
- Poora kaam ek hi message mein clearly batao: kya banana hai, kaunsa stack, kya zaroori hai, "done" kab maana jaayega.
- Bade kaam ke liye effort `high` ya `xhigh` rakho; chhote sawaalon ke liye `low` ya `medium`.
- Jo kaam purane chat se alag hai, uske liye naya chat kholo (sasta bhi padta hai, saaf bhi rehta hai).

## Kharcha (API pay-as-you-go)
| Model | Input / Output (per 1M tokens) | Kab use karein |
|---|---|---|
| `claude-opus-5-5` (default) | $4 / $20 | Best coding quality |
| `claude-sonnet-5-5` | $2 / $10 | Roz ka kaam, lagbhag aadhe daam mein |
| `claude-haiku-5-5` | $0.10 / $0.50 | Chhote, aasaan kaam |

Andaaza: chhota fix ≈ $0.05–0.30, ek poora chhota app ≈ $0.50–3. Prompt caching on hai, isliye lambe chats mein repeat context ka kharcha ~95% kam hota hai. Top bar mein har chat ka live cost dikhta hai. Console mein monthly spend limit zaroor set karo: https://console.anthropic.com/settings/limits

## Safety
- Agent sirf `WORKSPACE_DIR` ke andar files chhoo sakta hai (folder se bahar ke paths block hain).
- Commands aur delete se pehle aapki permission leta hai (jab tak auto-run on na ho).
- Aapki `ANTHROPIC_API_KEY` us shell tak nahi pahunchti jisme agent commands chalata hai.
- Server default se sirf aapke computer pe khulta hai (`127.0.0.1`). Internet pe deploy karna ho to `APP_PASSWORD` zaroor set karo, kyunki agent commands chala sakta hai.

## Settings (`.env`)
| Variable | Default | Matlab |
|---|---|---|
| `ANTHROPIC_API_KEY` | (zaroori) | Anthropic API key |
| `MODEL` | `claude-opus-5-5` | Naye chats ka default model |
| `EFFORT` | `high` | `low` / `medium` / `high` / `xhigh` / `max` |
| `WORKSPACE_DIR` | `./workspace` | Jis folder mein agent kaam karta hai |
| `GITHUB_TOKEN` | (khaali) | Private clone + push |
| `MAX_TASK_USD` | `3` | Ek message ka cost isse upar jaaye to agent ruk ke poochta hai |
| `MAX_TURNS` | `80` | Ek message mein maximum tool steps |
| `APP_PASSWORD` | (khaali) | Web UI ka password (browser login popup) |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Server address |

## Andar kaise kaam karta hai
```
Browser / CLI ──► server.ts (Express, SSE stream) ──► agent.ts (loop)
                                                       │  Claude Opus 5.5 (streaming, adaptive thinking,
                                                       │  effort, prompt caching, safety fallback)
                                                       ▼
                                                     tools.ts: list_files, read_file, write_file,
                                                     edit_file, search, run_command, delete_path
                                                     + server tools: web_search, web_fetch
```
- `src/prompt.ts`: system prompt (senior engineer ki tarah kaam karne ke rules: pehle samjho, phir likho, phir run karke verify karo)
- `src/agent.ts`: model ko stream karta hai, tool calls validate karke chalata hai, results wapas bhejta hai, aur model ke kaam khatam karne tak loop karta hai
- `src/store.ts`: chats `data/sessions/*.json` mein save hote hain
- `public/`: web UI (koi build step nahi)

Tests (fake API ke saath, koi key ya kharcha nahi):
```bash
npm test
npm run typecheck
```
