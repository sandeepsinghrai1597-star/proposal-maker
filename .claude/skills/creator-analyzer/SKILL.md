---
name: creator-analyzer
description: Reverse-engineer any Instagram creator's reel format (stories, script structure, visuals, animation, editing, captions, audio) using the ScrapeCreators connector via Composio plus local video analysis. Use when the user gives an Instagram handle or reel link and asks to analyse, study, copy the style of, or "iske jaise" a creator.
---

# Creator Analyzer

How `analysis/ranger_alex_analysis.md` was produced. Repeat it for any creator.

## 1. Fetch (ScrapeCreators through Composio, the user's own connected account)
Call `COMPOSIO_SEARCH_TOOLS` for scrapecreators, then with `COMPOSIO_MULTI_EXECUTE_TOOL`:
- `SCRAPECREATORS_GET_INSTAGRAM_PROFILE {handle}`: bio, followers
- `SCRAPECREATORS_LIST_INSTAGRAM_USER_REELS {handle}`: paginate 3 pages (`next_cursor`), rank by `play_count`
- For the top 6-8: `SCRAPECREATORS_GET_INSTAGRAM_POST {url}` (gives `video_url`, duration, music) and
  `SCRAPECREATORS_GET_INSTAGRAM_MEDIA_TRANSCRIPT {url}`
Do the downloads in `COMPOSIO_REMOTE_WORKBENCH` (stream with retries, the CDN drops connections),
then `upload_local_file()` one or two videos per call (60 s limit) and `curl -L` the returned links locally.
Direct Instagram access from the sandbox is rate-limited (429), so always go through the connector.

## 2. Measure (local)
Use the reel-editor skill scripts (`analyze.py` for cuts and grade numbers, `contact.py map --fps 1`
for contact sheets). Then:
- Read every contact sheet. Pull full-size frames (`ffmpeg -ss t -frames:v 1`) of the hook, a
  close-up, the badge/caption and the ending.
- Speech rate = words / duration x 60; voice pitch by autocorrelation; silence %.
- Low cut counts with obviously many images mean the transitions are dissolves: count images by eye.

## 3. Write the report
Same sections as the Ranger Alex report: account snapshot + performance table, script formula
(beats with timings and real quotes), visual style (look families with grade numbers, shot language,
transitions), on-screen text spec (position, size, colour, font type), ending/CTA, audio, likely
toolchain, and **copy vs make-our-own** (format yes, their footage and sentences no).
Then update `tools/story_reel/styles.py` and the script/visual skills if the new creator differs.
