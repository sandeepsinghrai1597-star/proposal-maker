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

## Keys (all optional, set as environment variables)
`GEMINI_API_KEY` (best images, character references) · `OPENAI_API_KEY` · `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID_AAKASH`, `ELEVENLABS_VOICE_ID_AYAAN`.
Python deps: `pip install numpy pillow faster-whisper edge-tts` + ffmpeg.

## Other tools
`tools/engine/` + `tools/render.mjs`: earlier canvas silhouette engine (kept for a text/animated
quote format). `reels/demo-1-percent/` is its test.
