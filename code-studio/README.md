# Code Studio: aapka apna AI coding agent (free, local)

Chat karo, code ban jaata hai. Code Studio aapke laptop pe chalta hai. Ek **open-source AI model** (Ollama ke through, bilkul free, internet ke bina bhi) aapke project folder ke andar kaam karta hai: code padhta hai, files likhta aur edit karta hai, commands chalata hai, tests run karta hai aur GitHub pe push karta hai.

Chahein to baad mein ek API key daal ke mushkil kaam ke liye **Claude Opus 5.5** pe bhi switch kar sakte ho (paid). Dono ka UI aur tools same hain.

> **Sach baat:** laptop pe chalne wala free model (9B) Opus 5.5 jitna smart nahi hai, aur CPU pe dheema chalta hai. Chhote, saaf kaam (ek page, ek function, bug fix, script) achhe se karta hai. Bade multi-file projects mein galti karega, tab Claude pe switch karna behtar hai.

## Kya-kya kar sakta hai
- Hindi, Hinglish ya English mein chat karo ("ek todo page banao", "is error ko fix karo")
- Project padhta hai (`list_files`, `read_file`, `search`), phir code likhta hai (`write_file`, `edit_file`)
- Khud check karta hai: `npm install`, build, tests (`run_command`)
- GitHub repo clone karta hai, commit aur push karta hai
- Har command chalane se pehle permission maangta hai (ya "auto-run" on karo)
- Web UI (laptop + phone) aur terminal CLI, dono
- Windows, Mac aur Linux teeno pe

## Setup (pehli baar, ~20 minute, zyada time model download mein lagta hai)

**1. Ye 3 cheezein install karo**
- **Node.js 20+**: https://nodejs.org (LTS wala)
- **Git**: https://git-scm.com (Windows pe isi ke saath "Git Bash" aata hai, jisse agent commands chalata hai)
- **Ollama**: https://ollama.com/download (install karke app khol do, ye background mein chalta rahega)

**2. Model download karo** (terminal / PowerShell mein, sirf ek baar)

| Aapka laptop | Command | Download |
|---|---|---|
| 16 GB RAM (recommended) | `ollama pull mimo-v2.6:9b` | ~6.6 GB |
| 8 GB RAM | `ollama pull qwen2.5-coder:7b` | ~4.7 GB |

8 GB RAM wale: `.env` mein `MODEL=qwen2.5-coder:7b` aur `NUM_CTX=8192` kar dena.

**3. Code Studio download karke chalao**
```bash
git clone https://github.com/sandeepsinghrai1597-star/proposal-maker.git
cd proposal-maker/code-studio
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm start
```
Browser mein kholo: **http://127.0.0.1:3000**

Windows pe aage se: `code-studio` folder mein **`start-windows.bat`** pe double-click karo. Ye sab khud kar dega aur browser khol dega.

Terminal mein chat karni ho to:
```bash
npm run cli                 # workspace/ folder mein
npm run cli -- my-app       # workspace/my-app mein
```

## Kaise use karein
1. **Naya project:** "workspace (root)" chuno aur likho: *"my-page folder mein ek HTML + JS todo app banao jo localStorage mein save kare"*.
2. **Apna GitHub repo:** sidebar mein `owner/repo` likho, "Clone" dabao. Naye chats usi folder mein kaam karenge. Private repo ke liye `.env` mein `GITHUB_TOKEN` daalo (GitHub → Settings → Developer settings → Fine-grained token → "Contents: Read and write").
3. Agent jo command chalayega, pehle poochega: **Run**, **Always run (this chat)** ya **Skip**.
4. Kaam ho jaaye to bolo: *"changes commit karke push karo"*.

**Local model se achha result lene ke tips**
- Ek message mein ek saaf kaam do. "Poora e-commerce site banao" ki jagah: pehle "product list page", phir "cart", phir "checkout".
- File ka naam aur kya chahiye, dono batao: *"src/utils.js mein formatPrice function add karo jo ₹ format kare"*.
- Jawab galat lage to error copy karke bhejo: *"ye error aa raha hai: ..."*.
- Speed chahiye to effort `low` rakho (model "sochna" band kar deta hai, jawab jaldi aata hai).
- Chat bahut lambi ho jaaye to naya chat kholo. Chhota model lambi baatein bhool jaata hai.

**Speed ka andaaza (CPU, no GPU):** 9B model lagbhag 4-10 words/second likhta hai. Ek chhoti file 1-3 minute mein. Pehla message thoda ruk ke aata hai kyunki model memory mein load hota hai.

## Optional: Claude Opus 5.5 (paid, sabse achhi quality)
`.env` mein `ANTHROPIC_API_KEY` daalo (https://console.anthropic.com/settings/keys) aur restart karo. Model picker mein `claude-opus-5-5 (paid)` aa jaayega. Har chat mein upar cost dikhta hai, aur ek task `MAX_TASK_USD` (default $3) se upar jaaye to ruk ke poochta hai.

| Model | Kharcha | Kab |
|---|---|---|
| `mimo-v2.6:9b`, `qwen2.5-coder:7b` | Free | Roz ke chhote kaam |
| `claude-sonnet-5-5` | $2 / $10 per 1M tokens | Bade kaam, kam daam |
| `claude-opus-5-5` | $4 / $20 per 1M tokens | Sabse mushkil kaam |

Koi aur Ollama model bhi chala sakte ho jo "tools" support kare (list: https://ollama.com/search?c=tools). `ollama pull <naam>` karo, refresh karo, picker mein aa jaayega.

## Safety
- Agent sirf `WORKSPACE_DIR` ke andar files chhoo sakta hai.
- Commands aur delete se pehle permission leta hai (jab tak auto-run on na ho).
- Server sirf aapke computer pe khulta hai (`127.0.0.1`). Phone/doosre device se kholna ho to `HOST=0.0.0.0` aur `APP_PASSWORD` dono set karo.

## Settings (`.env`)
| Variable | Default | Matlab |
|---|---|---|
| `MODEL` | `mimo-v2.6:9b` | Naye chats ka default model |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama ka address |
| `NUM_CTX` | `16384` | Local model ki memory (tokens). 8 GB RAM pe `8192` |
| `EFFORT` | `high` | Local: `low` = bina soche, tez. Claude: `low` se `max` |
| `WORKSPACE_DIR` | `./workspace` | Jis folder mein agent kaam karta hai |
| `GITHUB_TOKEN` | (khaali) | Private clone + push |
| `ANTHROPIC_API_KEY` | (khaali) | Optional, Claude models ke liye |
| `MAX_TASK_USD` | `3` | Claude task ka cost limit |
| `MAX_TURNS` | `80` | Ek message mein maximum steps |
| `APP_PASSWORD` | (khaali) | Web UI ka password |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Server address |

## Problem aaye to
| Dikkat | Hal |
|---|---|
| "Ollama is not running" | Ollama app kholo (ya terminal mein `ollama serve`) |
| "Model ... is not downloaded" | `ollama pull <model>` chalao |
| Bahut dheema / laptop hang | Chhota model (`qwen2.5-coder:7b`) aur `NUM_CTX=8192` karo, baaki apps band karo |
| Windows pe commands fail | Git for Windows install karo (Git Bash chahiye) |
| Model tool use karne ki jagah sirf code text mein likh deta hai | Bolo "write_file tool se file banao", ya `mimo-v2.6:9b` use karo |

## Andar kaise kaam karta hai
```
Browser / CLI ──► server.ts (Express, live stream) ──► agent.ts
                                                        ├─ local model ──► local-agent.ts ──► Ollama (aapka laptop)
                                                        └─ claude-*    ──► Anthropic API (optional)
                                                                 │
                                                                 ▼
                                    tools.ts: list_files, read_file, write_file, edit_file,
                                              search, run_command, delete_path
```
- `src/prompt.ts`: system prompt (pehle samjho, phir likho, phir chala ke check karo)
- `src/local-agent.ts`: Ollama loop, chhote model ke liye purani baatein trim karta hai taaki memory mein fit ho
- `src/store.ts`: chats `data/sessions/*.json` mein save
- `public/`: web UI (koi build step nahi)

Tests (nakli Ollama aur nakli API ke saath, koi download ya kharcha nahi):
```bash
npm test
npm run typecheck
```
