# Story Reel Factory

Illustrated Hindi moral-story reels (the format reverse-engineered from @ranger_alex_, 51M-view
top reel). One prompt → script → visuals → voice → captions → 1080x1920 MP4.

## Start here
| Doc | What |
|---|---|
| `analysis/ranger_alex_analysis.md` | Full breakdown: stories, 6-beat script formula, two visual styles, badge/caption spec, audio |
| `analysis/voice_analysis.md` | Measured pauses/pitch/expression of your ElevenLabs voices and how the TTS copies them |
| `.claude/skills/story-reel-studio` | **"Reel banao: <topic>"**, the whole pipeline |
| `.claude/skills/story-reel-script` | Script writer (6 beats, Devanagari VO + Hinglish captions) |
| `.claude/skills/story-reel-visuals` | Art director: style A/B, character sheets, shot list, prompts, camera |
| `.claude/skills/creator-analyzer` | Analyse any other creator the same way (ScrapeCreators via Composio) |

## Pipeline
```bash
# 1-2. In Claude Code: "reel banao: comfort zone" -> writes reels/<slug>/shots.json
python3 tools/story_reel/make_reel.py reels/<slug> --persona aakash   # images -> voice -> sync -> music -> render
```
Or step by step:
```bash
python3 tools/story_reel/gen_images.py reels/<slug> --characters   # GEMINI_API_KEY / OPENAI_API_KEY, else prompts.md for the apps
python3 tools/story_reel/tts.py reels/<slug> --plan                # see the directed read (phrases + pauses)
python3 tools/story_reel/tts.py reels/<slug> --persona ayaan       # ELEVENLABS_API_KEY (+ voice IDs) / OPENAI / free edge-tts
python3 tools/story_reel/align.py reels/<slug>                     # exact caption + shot timing
python3 tools/make_music.py --seconds 62 --lift 34 --out reels/<slug>/music.wav
python3 tools/story_reel/assemble.py reels/<slug>                  # final.mp4 (add --preview for a fast 540p check)
```
Optional motion: animate each `images/<id>.png` in Meta AI / Grok Imagine / Kling with the motion
prompt from `prompts.md` and save as `clips/<id>.mp4`; `assemble.py` uses clips automatically.

## 100% open-source mode (default, no keys)
| Step | Model | License |
|---|---|---|
| Images | SDXL base + ByteDance **SDXL-Lightning** 4-step (`tools/story_reel/local_images.py`) | OpenRAIL++ |
| Voice | **Kokoro-82M** Hindi male voices (`tools/story_reel/kokoro_worker.py`), pitch-matched to Aakash/Ayaan, directed by the measured pause engine (Indic Parler-TTS also supported, needs a free HF token) | Apache-2.0 |
| Animation | **LTX-Video 2B 0.9.6 distilled** image-to-video (`tools/story_reel/animate.py`), T5-XXL bf16 text encoder; Depth-Anything-V2 2.5D parallax fallback | LTX Open Weights / Apache-2.0 |
| Captions sync | exact phrase map (no ASR) or faster-whisper | MIT |
| Music | own numpy synth (`tools/make_music.py`) | ours |

Setup once:
```bash
python3 -m venv ~/ml && ~/ml/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu && ~/ml/bin/pip install diffusers transformers accelerate safetensors sentencepiece pillow
~/ml/bin/pip install --no-deps kokoro misaki && ~/ml/bin/pip install loguru soundfile scipy phonemizer-fork espeakng-loader num2words
```
CPU speed (4 cores): ~30 s per image, ~0.2x real time for voice, ~6 min render for a 69 s reel. A GPU (Colab/Kaggle free tier) is ~50x faster.

## Keys (all optional, set as environment variables)
`GEMINI_API_KEY` (best images, character references) · `OPENAI_API_KEY` · `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID_AAKASH`, `ELEVENLABS_VOICE_ID_AYAAN`.
Python deps: `pip install numpy pillow faster-whisper edge-tts` + ffmpeg.

## Other tools
`tools/engine/` + `tools/render.mjs`: earlier canvas silhouette engine (kept for a text/animated
quote format). `reels/demo-1-percent/` is its test.
