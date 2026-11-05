# Reel Factory (work in progress)

Animated vertical-reel engine: `scenes.json` → 1080x1920 MP4.

- `tools/engine/engine.js` – canvas animator (backgrounds, silhouette characters, kinetic captions, camera, transitions)
- `tools/engine/index.html` – open in Chrome to preview a `scenes.json`
- `tools/render.mjs` – headless render: `node tools/render.mjs reels/<slug>/scenes.json`
- `tools/make_music.py` – royalty-free synthesized music bed: `python3 tools/make_music.py reels/<slug>/scenes.json`
- `reels/demo-1-percent/` – engine test reel

**Status:** the visual style here is a placeholder. The reference-creator analysis is pending
(reference reels still to be supplied); style, characters, script skill and visual skill will be
built from that analysis.
