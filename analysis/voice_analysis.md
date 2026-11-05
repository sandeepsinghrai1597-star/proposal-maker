# Voice Analysis: the user's ElevenLabs reference renders

8 unique files (one of the 9 uploads is a duplicate), 13.5 minutes in total. Two voices:
**Aakash Aryan (Mystery & Thriller, PVC)** ×4 and **Ayaan (Spiritual Story Narrator, PVC)** ×3, plus 1 unnamed.
Settings in the filenames: `s50` stability 0.50 · `sb75`/`sim75` similarity 0.75 · `sp100` speed 1.00 · `v4`.

Method: silence detection (frames 30 dB below the speech peak, ≥ 120 ms = a pause), autocorrelation
pitch, loudness spread, plus Whisper word timestamps to see *where* the pauses fall.

## Measured numbers

| File | Voice | Length | Pauses/min | Median pause | p25-p75 | Longest | Pause share | Pitch median (p10-p90) | Dynamics |
|---|---|---|---|---|---|---|---|---|---|
| 43e32212 | Aakash | 96 s | 17.4 | 0.40 s | 0.18-0.48 | 0.64 | 10 % | 123 Hz (86-186) | 18.0 dB |
| 5eb5e76f | Aakash | 122 s | 34.8 | 0.34 s | 0.22-0.40 | 0.53 | 18 % | 129 Hz (88-198) | 16.8 dB |
| 6a123620 | Aakash | 108 s | 31.8 | 0.36 s | 0.22-0.43 | 0.63 | 18 % | 127 Hz (86-193) | 17.7 dB |
| c72c9053 | Aakash | 131 s | 28.9 | 0.27 s | 0.18-0.34 | 0.54 | 13 % | 128 Hz (87-203) | 17.9 dB |
| 6cbf7871 | Ayaan | 72 s | 35.7 | 0.42 s | 0.24-0.50 | 0.56 | 22 % | 147 Hz (107-219) | 21.6 dB |
| 79624b3a | Ayaan | 58 s | 36.3 | 0.46 s | 0.38-0.55 | 0.64 | 27 % | 137 Hz (103-208) | 21.8 dB |
| 908dbd23 | Ayaan | 67 s | 42.0 | 0.37 s | 0.25-0.46 | 0.57 | 25 % | 145 Hz (103-213) | 20.8 dB |
| 245f22dd | (unnamed) | 97 s | 34.8 | 0.44 s | 0.39-0.49 | 0.72 | 24 % | 137 Hz (101-208) | 21.6 dB |

## What makes these voices sound premium

1. **Pauses are short and very regular.** Almost all pauses are 0.2-0.55 s and the longest is about 0.65 s.
   No dead air. A breath comes every **5-9 words** (about every 1.7-2 s).
2. **Pause hierarchy (from the word timings):**
   - comma / breath → **0.18-0.25 s**
   - full stop → **0.35-0.45 s**
   - question → **0.45-0.5 s**
   - **rhetorical question, then a short answer → the longest pause, 0.7-0.85 s**
     ("चाँद की कितनी पत्नियाँ थीं? … सत्ताइस।")
   - before a contrast or twist word (**पर / लेकिन / असली हैरानी…**) → a sentence-level pause, then a new rise in pitch
3. **Wide pitch range.** p10-p90 spans more than a full octave (Aakash 87→195 Hz, Ayaan 104→213 Hz).
   That is the "expression": low, dark story lines and lifted questions or exclamations. Flat TTS stays inside ±3 semitones.
4. **Two personas:**
   - **Aakash:** deep (≈127 Hz), tighter (10-18 % pauses), controlled loudness (≈17.6 dB): thriller and suspense, fits Style B / power stories.
   - **Ayaan:** warmer and higher (≈143 Hz), breathes more (22-27 % pauses), more dynamic (≈21 dB): spiritual and emotional, fits Style A / tragic stories.
5. **Speech rate** (all 8 files, including pauses): **Aakash 135-145 wpm**, **Ayaan 115-138 wpm**,
   much slower than the Ranger reference (~185 wpm, no pauses). For a 60 s reel write **140-150 words
   (Aakash)** or **120-135 words (Ayaan)**. The 179-word demo script runs ~75 s with Aakash: trim it, or
   accept a 70-75 s reel.
6. **Script style in the samples:** mythology/history facts told as stories, direct audience questions
   ("यही सुना है ना?"), numbers ("सत्ताइस बेटियाँ", "1792"), and a twist hook ("लेकिन असली हैरानी की बात अभी बाकी है").

## How tools/story_reel/tts.py reproduces it

| Reference trait | Implementation |
|---|---|
| Regular breaths every 5-9 words | `direct()` splits at punctuation, then breaks any phrase over 8 words before a conjunction (और/पर/कि/जो/क्योंकि/सिर्फ…) |
| Pause hierarchy | measured table `PAUSE` (comma 0.22 · sentence 0.40 · question 0.46 · `...` 0.52 · rhetorical 0.78 · before moral 0.62), scaled ×0.92 for Aakash and ×1.12 for Ayaan |
| Exact pause lengths | each phrase is synthesised separately, silence-trimmed and re-joined with the measured gap + room tone (10 ms crossfades), so pauses never depend on the model's mood |
| Continuous intonation | ElevenLabs `previous_text` / `next_text` for every phrase |
| Expression | per-beat settings: hook (stability 0.42, speed 0.97) · dialogue (0.36, more style) · turn (0.38, speed 0.95) · moral (0.55, speed 0.93, weightier) · cta (0.55, 1.02) |
| Same voices | persona → ElevenLabs voice by name or `ELEVENLABS_VOICE_ID_AAKASH` / `_AYAAN`, base settings 0.50 / 0.75 / speed 1.0 |
| Broadcast sound | high-pass 70 Hz, -2 dB at 250 Hz, +2.5 dB presence at 3.2 kHz, 3:1 compression, -16 LUFS voice stem |
| QC | after rendering, pauses/min, median pause, pause share and longest pause are measured and checked against this table (PASS/WARN) |
| Captions | `voice_map.json` stores every phrase's start/end, so `align.py` syncs captions and shot changes to the frame without speech recognition |

Free fallback: same direction and pause engine with edge-tts `hi-IN-MadhurNeural` (pitch lowered
for Aakash). It is clearly less expressive than the ElevenLabs PVC voices; use it for drafts only.
