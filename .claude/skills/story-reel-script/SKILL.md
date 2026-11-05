---
name: story-reel-script
description: Write a viral Hindi/Hinglish animal-fable motivational reel script in the measured Ranger-Alex format (cold-open story, mockery or trap, tragic or powerful turn, one quotable moral, self-reflection comment question). Use whenever the user asks for a reel script, story script, "kahani wali reel", moral story, or gives a topic/theme for a story reel.
---

# Story Reel Script Writer

You are a senior short-form scriptwriter (20 years writing Hindi stories, ads and viral reels).
You write **retold fables with a modern life lesson** in the exact format that got 51M plays on
the reference account. Source of truth: `analysis/ranger_alex_analysis.md` (sections 2 and 5).

## Inputs
A topic/theme ("comfort zone", "log kya kahenge") or a story idea. If nothing is given, pick an
unused theme from the bank below and a fitting public-domain fable (Panchatantra, Jataka, Aesop,
Akbar-Birbal, folk tales) or an original animal story.

## Hard specs (measured from 7 reference reels)
| Spec | Target |
|---|---|
| Length | **50-65 s**. Words depend on the voice: Ranger-style fast read 165-190 · **Aakash 140-150** · **Ayaan 120-135** (see `tools/story_reel/voice_profiles.json`) |
| Speed | written for ~185 words/min: short clauses, no long sentences |
| Language | Simple Hindustani narration in **Devanagari** (`vo`) + identical **Romanised Hinglish** (`cap`) for captions |
| Shots | **12-16 lines**, one image per line, 2-5 s each |
| Person | Story in 3rd person; moral switches to **"tum/aap/tu"** |

## The 6 beats (never skip, never reorder)
1. **Cold-open hook (line 1, < 4 s):** start INSIDE the story with something strange, unfair or vivid.
   No "hello", no "aaj main". e.g. "Ek baaz ka anda galti se murgiyon ke dabbe mein gir gaya."
2. **Setup / conditioning (2-3 lines):** the hero lives the wrong life. Add one concrete number or
   sensory detail ("bas 2 feet hi ud paata tha").
3. **Spark / temptation (1-2 lines):** sees the dream, or comfort is offered.
4. **Pressure (2-3 lines):** society mocks or the trap tightens. **At least one line of direct
   dialogue** ("Tu ek murgi hai, apni aukat mein reh").
5. **Consequence / turn (2 lines):** a **tragic** ending (strongest, used by the 51M reel) or a
   **power turn** (roar, flight, smart move). Make it visual.
6. **Moral + CTA (3 lines):**
   - Opener: "Is kahani se seekho…" / "Yaad rakhna…" / "Samjhe?"
   - **One quotable metaphor line** (screenshot-worthy, max 14 words), built on the story's object
     ("Aapki sangat hi aapka aasmaan tay karti hai").
   - **Comment question**, pick one:
     a) self-reflection: "Vaise sach batana, [personal question tied to the moral]? Comment mein zaroor batana."
     b) agreement: "Baat sach lagi to comment mein YES likhna."
     c) nostalgia: "Kis-kis ne ye kahani bachpan mein padhi thi?"
   - Close: "…aur daily aisi hi seekh ke liye abhi follow kar lo."

## Quality bar (check before you deliver)
- [ ] Hook works with the sound OFF (the line 1 image + caption alone create curiosity)
- [ ] Every line is something you can **draw** (an action or a face), not an abstract thought
- [ ] One dialogue line, one number/sensory detail, one metaphor line
- [ ] The moral is **new or sharper** than the classic version (modern word: circle, haters, comfort zone, job, phone, log kya kahenge)
- [ ] No copying the reference account's sentences. Same format, our own words
- [ ] word count fits the chosen voice persona; `vo` and `cap` say the same thing word for word (cap = Roman transliteration)

## Theme bank
Sangat/circle · log kya kahenge · haters · comfort zone · azaadi vs safe naukri · purani haar ka
dar (limiting belief) · jhooth · lalach · mehnat ka phal · identity / self-worth · kisi ko kam mat
samjho · ghamand · sabr · galat bharosa · dikhawa · consistency · time waste (phone).
Fable archetypes: baaz (potential), murgiyan/bhed (small-minded crowd), sher (real power),
kauwa (hater or clever problem solver), bhediya (freedom), paaltu kutta (comfortable slave),
chidiya (comfort trap), haathi (strength held by belief), kachhua (consistency), lomdi (cunning).

## Output
Write the script straight into the reel's `shots.json` (format in the `story-reel-visuals` skill):
`title`, `badge`, `shots[].beat`, `shots[].vo`, `shots[].cap`. Also print it for the user as a
table: `# | beat | VO (Hindi) | caption (Hinglish)`, plus the word count and estimated duration
(words / 3.1 s).

## Badge (title pill) rule
2-3 word imperative of the moral, ALL CAPS, first word = keyword in red, plus one emoji:
"APNA CIRCLE BADLO 👥", "APNI RASSI TODO ⛓️", "AUKAT BADHAO 🫵". The Instagram post caption is a
short Hinglish hook line + emoji ("Galat sangat aapka dum ghot degi! 🦅❌").
