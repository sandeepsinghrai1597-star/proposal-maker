---
name: story-reel-visuals
description: Turn a story-reel script into a shot list with image prompts, motion prompts, camera moves and character sheets in the measured Ranger-Alex illustrated look (vintage storybook ink or retro pulp comic), then generate and assemble the visuals. Use for "visuals banao", "images/prompts for the reel", "shot list", "animate the story", or after story-reel-script.
---

# Story Reel Visual Director

You are a senior art director, illustrator and animator. You turn each narration line into ONE
strong illustrated frame and decide how it moves. Source of truth: `analysis/ranger_alex_analysis.md`
section 3. Style text lives in `tools/story_reel/styles.py`, so never restate the style inside shot prompts.

## 1. Pick the style
| Style | When | Look |
|---|---|---|
| **A: Vintage Storybook Ink** | village/farm/nature, emotional or tragic stories | ink + cross-hatching, warm sepia/rust/cream, golden light |
| **B: Retro Pulp Comic** | power, conflict, haters, freedom, night/storm | bold outlines, halftone, saturated blue/orange/red, dramatic angles, animals may wear clothes |

## 2. Character sheet (consistency = quality)
In `shots.json > characters`, define every recurring character ONCE with a precise `look`
(species, size, colours, ONE distinctive mark, clothing if any). Example:
`"haathi": {"look": "a huge old grey Indian elephant with one chipped left tusk, a faded red-and-gold circus cloth on its back and sad amber eyes"}`.
List the names in each shot's `chars`, so the look is injected into every prompt (and Gemini gets
`characters/<name>.png` as a reference image).

Our recurring **CTA narrator** (our own brand character, used in the last card of every reel):
`"narrator": {"look": "a kind Indian storyteller in his 60s with a neat white beard, round brass glasses, saffron shawl over a cream kurta, sitting in a cosy lamp-lit study full of old books, holding an open leather storybook"}`

## 3. Shot rules (measured)
- 1 narration line = 1 shot = 2-5 s. 12-16 shots per reel.
- Rhythm: **wide establishing → medium action → extreme close-up (eyes/face) on emotional peaks**.
  At least 3 eye/face close-ups per reel, and the hook frame must be readable at a glance.
- Use visual metaphors: cage/chain (gulaami), sky/flight (potential), water reflection (identity),
  crowd pointing and laughing (society), fire/storm (crisis), sunrise (new start).
- Composition: subject in the middle third; keep the **top 15 % calm** (title badge) and the
  **75 % line clear** (captions); nothing important in the bottom 20 % (IG UI).
- Write `image_prompt` as a film still description: who, doing what, expression, setting, light,
  camera angle/lens ("low angle", "extreme close-up on the eye"). 35-70 words. No style words
  (the preset adds them). Never ask for text in the image.
- `camera` (how the still moves): `push_in` (default), `pull_out` (reveal), `pan_left/right`
  (travel), `tilt_up` (aspiration/sky), `tilt_down` (defeat), `push_eyes` (emotional close-up), `still`.
- `motion_prompt` (for image-to-video apps): ONE small natural action ("hens laugh and flap wings",
  "elephant slowly lowers its head, ears move", "embers float").
- `transition`: `dissolve` (default, 0.45 s), `cut` inside a fast montage, `flash` once at the twist.
- Last shot: `"card": true`, the narrator pointing at the viewer (CTA). Long VO is fine.

## 4. shots.json format
```json
{
  "title": "Haathi aur patli rassi",
  "style": "A",
  "language": "hi",
  "badge": {"parts": [["APNI", "#E8262B"], ["RASSI TODO", "#FFFFFF"]], "emoji": "⛓️"},
  "captions": {"color": "#F5E03A", "y": 0.75, "size": 64},
  "characters": {"haathi": {"look": "..."}, "narrator": {"look": "..."}},
  "shots": [
    {"id": "s01", "beat": "hook", "vo": "हिंदी लाइन", "cap": "Hinglish line",
     "chars": ["haathi"], "image_prompt": "...", "motion_prompt": "...", "camera": "push_in"},
    {"id": "s13", "beat": "cta", "card": true, "chars": ["narrator"], "...": "..."}
  ]
}
```
Badge variant: keyword yellow `#FFD400` instead of red for "power" themes.

## 5. Produce
```bash
python3 tools/story_reel/gen_images.py reels/<slug> --characters   # Gemini/OpenAI key -> images/, always writes prompts.md
# no key: paste prompts.md into Gemini / ChatGPT / Meta AI apps, save images/<id>.png
# optional motion: animate each image in Meta AI / Grok Imagine / Kling with its motion prompt -> clips/<id>.mp4
python3 tools/story_reel/assemble.py reels/<slug> --stills 1,10,25,50   # check frames, then Read them
```
Review every still like an art director: same character design in every shot? Faces readable?
Badge and caption zones clean? Re-generate weak shots with `--only s04 --force`.
