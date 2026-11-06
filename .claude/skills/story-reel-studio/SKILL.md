---
name: story-reel-studio
description: One-command factory for illustrated Hindi moral-story reels in the Ranger-Alex format. From a single prompt ("reel banao: comfort zone" / "make a story reel about haters") it writes the script, builds the shot list and prompts, generates images, voice, music, syncs captions and renders a 1080x1920 MP4. Use whenever the user asks to generate/make/banao a reel, story video or animation.
---

# Story Reel Studio (orchestrator)

Run the whole pipeline. Each step has its own skill or tool. Work folder: `reels/<slug>/`.

| # | Step | How | Output |
|---|---|---|---|
| 1 | Script | follow `.claude/skills/story-reel-script/SKILL.md` | `shots.json` (title, badge, vo, cap) |
| 2 | Visual direction | follow `.claude/skills/story-reel-visuals/SKILL.md` | `shots.json` (style, characters, prompts, camera) |
| 3 | Images | `python3 tools/story_reel/gen_images.py reels/<slug> --characters` | `images/*.png`, `prompts.md` |
| 4 | **Animate** | `~/ml/bin/python tools/story_reel/animate.py reels/<slug>` (LTX-Video image-to-video, ~2.5-5 min/shot on CPU; `--engine parallax` = fast 2.5D depth fallback). Run AFTER step 6 so clip lengths follow the voice | `clips/*.mp4` |
| 5 | Voice | `python3 tools/story_reel/tts.py reels/<slug>` | `voice.mp3` |
| 6 | Sync | `python3 tools/story_reel/align.py reels/<slug>` | `timing.json` |
| 7 | Music | `python3 tools/make_music.py --seconds <total> --lift <turn s> --out reels/<slug>/music.wav` | `music.wav` |
| 8 | Render | `python3 tools/story_reel/assemble.py reels/<slug>` | `final.mp4` |
| 9 | QC | `python3 tools/story_reel/assemble.py reels/<slug> --stills ...` and Read them; ffprobe the MP4 | report |

Order in practice: 1 → 2 → 3 → 5 → 6 → 4 → 7 → 8. Shortcut for steps 3-8: `python3 tools/story_reel/make_reel.py reels/<slug>` (skips steps whose
inputs are missing and tells you what is needed).

## Rules
- Never skip step 1's quality checklist or step 2's art-director review of the stills.
- **Default = 100 % open-source, no keys:** images with SDXL + SDXL-Lightning (`local_images.py`, ~30 s/image
  on CPU; use `--variants 3` for weak shots and pick by eye), voice with Kokoro-82M (`hm_omega` = Aakash pitch,
  `hm_psi` = Ayaan pitch) directed by the measured pause engine. Write a concise framing-first
  `sdxl_prompt` per shot (CLIP reads 77 tokens) and `sdxl_no_chars: true` for close-ups/no-character shots.
  Every shot MUST move like the reference: write a strong `motion_prompt` (one clear action + one ambient motion)
  and animate with `animate.py`; never ship stills-only.
- Keys: `GEMINI_API_KEY` (images), `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` (voice) are optional upgrades.
  Without them: images come from the free apps via `prompts.md`; voice via free edge-tts (runs on a
  normal PC/phone internet; it cannot run inside a cloud sandbox whose proxy blocks WebSockets).
  `pollinations` images are draft quality: use them only to test the layout, never for posting.
- Without `voice.mp3`, `assemble.py` uses estimated timing (3.1 words/s) for a silent preview.
- Deliver: `final.mp4`, the script table, the IG caption + 5 hashtags, and the best posting note
  (the reference posts ~6-7 am IST and ~11:30 am IST; 1 reel/day).

## Report to the user (in Hinglish)
1. Final video path, length, size. 2. Script table. 3. Which steps used free vs paid tools.
4. What to improve next (weak shots to regenerate, whether to add motion clips).
