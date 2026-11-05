# @ranger_alex_: Reverse-Engineering Report

**Data source:** ScrapeCreators (Composio). Profile + 33 reels listed, top 8 reels detail + transcript,
7 videos downloaded and analysed frame by frame (contact sheets at 1 fps, cut detection,
colour grade numbers, speech rate, voice pitch). Date: 5 Nov 2026.

---

## 1. Account snapshot

| Field | Value |
|---|---|
| Name | Ranger Alex (Digital creator) |
| Bio | "AI visual stories. Real life lessons." + course site rangeralex.in |
| Followers | ~66K, following 77 |
| Content age | Mid-Oct 2026 onwards, roughly 1 reel/day |
| Monetisation | Selling a course ("free AI tools se mobile par aisi animation banao") |

### Performance (top reels by plays)

| Plays | Likes | Title badge / caption | Story |
|---|---|---|---|
| **51.4M** | 3.0M | GALAT SANGAT AAPKA DUM GHOT DEGI 🦅 (badge: APNA CIRCLE BADLO 👥) | Eagle egg raised among hens dies a hen |
| 1.33M | 79K | Ham sabko khush nahi rakh sakte | Father, son and donkey (log kya kahenge) |
| 278K | 21K | Apni aukat badhao 🫵 | Lion ignores dogs, eagle flies high till the crow suffocates |
| 72K | 2.3K | Comfort zone aapke pankh kaat deta hai 🪽 | Sparrow in a golden cage gets eaten |
| 55K | 3.1K | Jhooth musibat laata hai | (lie → trouble) |
| 47K | 2.9K | Mehnat kabhi zaya nahi jaati | Thirsty crow and pebbles |
| 30K | 1.6K | Bhedon ke beech sher 🦁👑 | Lion cub raised by sheep sees its reflection |
| 24K | 1K | Roti ke badle ghulaami? 🐺⛓️ | Wolf rejects the chained dog's comfort |

**Insight:** the stories that went viral end tragically or with sharp reality (the eagle dies a hen,
"duniya har haal mein naam rakhegi"). Reels with a pure course pitch at the end get 10-100x less reach.
The 51M reel ends with an **engagement question** ("tumhara circle aage badha raha hai ya peeche
kheench raha hai?"), not a sales pitch.

Older reels (horror, "agar suraj gayab ho jaaye", metro) flopped (4K-27K). The niche that works is
**animal fables + life lessons**.

---

## 2. Content formula (the script)

Measured on 7 transcripts: **47-66 s**, **147-195 words**, **175-197 words/minute** (fast,
continuous narration with almost no pause: silence < 2%).

### The 6-beat structure (in every reel)

| # | Beat | Time | What happens | Real example |
|---|---|---|---|---|
| 1 | **Cold-open hook** | 0-4 s | Starts straight inside the story with a strange or vivid situation. No "hello", no intro. | "Ek baaz ka anda galti se murgiyon ke dabbe mein gir gaya…" |
| 2 | **Setup / conditioning** | 4-15 s | The hero lives the wrong life, under the wrong identity. | "2 feet hi ud paata tha" |
| 3 | **Spark / temptation** | 15-25 s | Sees the dream or is offered comfort. | "Aasmaan mein ek vishaal baaz dekha" / "sone ka pinjra" |
| 4 | **Pressure / conflict** | 25-40 s | Society mocks or the comfort trap tightens (direct dialogue!). | "Tu ek murgi hai, apni aukat mein reh" |
| 5 | **Consequence / turn** | 40-48 s | Either a **tragic end** (bigger impact) or a **powerful turn** (roar, flight, choice). | "…aam murgi ki tarah mar gaya" |
| 6 | **Moral + CTA** | 48-60 s | "Is kahani se seekho / Yaad rakhna / Samjhe", then 1 quotable line, then a comment question, then follow. | "Aapki sangat hi aapka aasmaan tay karti hai" |

### Writing rules that make it work
1. **Second-person punch in the moral:** "tu / aap" ("tu har do kaudi ke insaan se ladne mein waqt barbaad kar raha hai").
2. **One memorable metaphor line** that can be screenshotted ("aaram aur comfort zone aapko ek din mein nahi maarte, woh dheere-dheere aapke pankh kaat dete hain").
3. **Dialogue inside the story** (mockery or lesson spoken by a character) makes it emotional.
4. **Concrete numbers and sensory details:** "2 feet", "2 inch bhi upar na uth saki", "mitti ka matka", "lohe ki zanjeer ke chhaale".
5. **Classic fables, retold.** Panchatantra/Aesop (thirsty crow, father-son-donkey, wolf and dog) give instant familiarity, plus a modern moral twist (circle, haters, comfort zone, log kya kahenge).
6. **Engagement CTA types:**
   - Self-reflection question: "Sach batana, kya aapka circle…" (best performer)
   - Agreement bait: "Baat sach lagi to comment mein YES likhna"
   - Nostalgia: "Kis-kis ne ye kahani school mein padhi thi?"
7. **Language:** simple Hindi/Hindustani narration, Hinglish words (talent, comfort zone, haters, oxygen).

### Theme bank (from the account)
Sangat/circle · log kya kahenge · haters ko ignore karo · comfort zone · azaadi vs gulaami ·
jhooth · mehnat · lalach · identity/self-worth (sher among sheep) · kisi ko kam mat samjho.

---

## 3. Visual style

### 3.1 Image look: AI illustrations, two style families

**Style A: "Vintage Storybook Ink"** (51M eagle reel, crow, sparrow)
- 1970s graphic-novel / storybook illustration, **detailed ink linework, cross-hatching**
- Warm, muted palette: burnt orange, rust, sepia, cream, olive; **aged-paper texture**
- Golden-hour or overcast light, rustic Indian/European village farm settings
- Measured grade: warmth (R-B) **≈ 69-70**, saturation **≈ 0.44-0.48**, luma 117-140 (bright and warm)

**Style B: "Retro Pulp Comic"** (wolf-dog, eagle-crow, lion)
- Bold black outlines, halftone/flat comic colours, **saturated** (deep blues, oranges, reds)
- Anthropomorphic animals sometimes wear **human clothes** (wolf in a military jacket, dog in a shirt)
- Dramatic angles: extreme close-ups on eyes/beak, speed lines, storm/lightning skies
- Measured grade: warmth **≈ 26-47**, saturation **≈ 0.50-0.54**, darker luma 88-95 (moodier)

### 3.2 Shot language
- **1 image ≈ 1 narration phrase.** About **15-20 different shots per 60 s**, average **3-4 s per shot**
  (the analyser saw only 13-25 hard cuts because most changes are **dissolves**).
- Shot pattern: **wide establishing → medium action → extreme close-up of eyes/face at emotional peaks**
  (caged eagle eye at 12 s, angry wolf face, crow's eye while suffocating).
- **Motion:** every still is animated by image-to-video AI. Subtle character motion (head turn,
  wings, laughing hens, falling feathers) plus slow camera push/pan. No static frames.
- **Transitions:** soft cross-dissolve 0.3-0.6 s (double exposure visible at 14 s and 33 s);
  one **rapid montage** of 5-6 quick cuts (0.2-0.3 s each) at the story's turning point (10.8-12 s).
- Recurring visual metaphors: cage/chain (gulaami), sky/flight (potential), reflection in water
  (identity), crowd pointing and laughing (society).

### 3.3 On-screen text
| Element | Spec (measured from frames) |
|---|---|
| **Title badge** | Top, y ≈ 4-8% of the frame, full-width rounded pill, **dark translucent** (black ~55%), condensed ALL-CAPS bold font (Oswald/Anton type). **First keyword in RED** (#E8262B), rest **WHITE**, one emoji at the end. Variant: keyword in **YELLOW** ("Apni **Aukat** badhao 👊"). Stays on for the whole reel (except the CTA card). |
| **Captions** | **One word at a time**, synced to the voice. Small (~4.5% of height), **yellow (#F5E03A)** with a thin dark outline/shadow, centred at **y ≈ 75%**. **Romanised Hinglish** even when the voice is Hindi ("baaz", "murgiyon", "zaroor"). |
| **Text in images** | Only on the CTA card (Comment/Follow bubbles, countdown on a phone). |

### 3.4 Ending (CTA card, last ~4-6 s)
- A consistent **narrator character** (in the eagle reel a young woman in a cosy library holding
  a storybook, pointing at "💬 Comment" and "🔔 Follow +" bubbles), framed as a **picture card on
  cream paper**.
- Course reels: a comic narrator pointing at a giant phone with a "LAUNCH IN 02 DAYS" countdown.

### 3.5 Audio
- **AI voiceover** (male storyteller, median pitch ≈ 155-160 Hz, energetic, fast, Hindi).
- Under it a continuous emotional/cinematic **music bed** ("Original audio" on every reel).
- No silence gaps: voice runs wall to wall.

---

## 4. Production pipeline he is (almost certainly) using
His bio and pitch say "100% free AI tools on mobile". The visual evidence fits:
1. Script (ChatGPT/Gemini) → 2. Images (Gemini / ChatGPT / Meta AI, comic style prompt) →
3. Image-to-video (Meta AI / Grok Imagine / Kling / Hailuo free tiers) → 4. AI voice (ElevenLabs /
similar) → 5. CapCut: dissolves, auto-captions (single word, yellow), top title badge, music.

---

## 5. What we copy vs what we make our own

| Copy (format, proven) | Make our own (originality and brand) |
|---|---|
| 6-beat fable structure, 50-60 s, ~185 WPM | Our own stories/twists + new modern morals |
| Illustrated comic look (style A/B), dissolves, eye close-ups | Our own **narrator character** for the CTA card |
| Top badge (red keyword + white + emoji) | Our badge colour accent and channel handle |
| Single-word yellow captions at 75% | Our voice persona |
| Self-reflection comment question | Our CTA wording + (later) our own offer |

We do **not** re-upload or re-cut his videos, images or exact text. The fables themselves
(Panchatantra/Aesop) are public domain, so we retell them in our own words.
