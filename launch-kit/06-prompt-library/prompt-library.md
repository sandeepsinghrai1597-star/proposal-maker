# Prompt Library: client delivery in hours, not days

Use with Claude or ChatGPT. Fill the `{{variables}}` from the client's onboarding form
(`08-client-onboarding`). Run the prompts **in order**, because each one feeds the next.

**Quality rule:** AI writes the first draft, you and the client make it theirs. Always paste 5–10
of the client's real captions or comments into the `{{voice_samples}}` slot. That one step is what
stops the output sounding generic.

---

## P0: Client brief (run once, reuse everywhere)
```
You are a senior information-product strategist for Indian creators.
Build a one-page CLIENT BRIEF from the raw notes below. Output sections:
1. Creator snapshot (niche, followers, tone, languages)
2. Ideal buyer (age, city tier, income band, top 3 pains in their own words, top 3 desires)
3. The #1 "transformation" the product promises (from → to, in under 20 words, no income/health guarantees)
4. 3 product format options (ebook / mini-course / challenge) with suggested INR price points and a one-line reason each
5. Recommended option and why
6. Words and phrases the creator uses (for voice-matching)
7. Claims to AVOID (medical, financial, income guarantees, SEBI-regulated advice)

Raw notes:
- Niche: {{niche}}
- Followers: {{followers}}
- Top questions from comments/DMs: {{top_questions}}
- Past offers / attempts: {{past_attempts}}
- Voice samples (captions/comments): {{voice_samples}}
- Language preference: {{language}}  (e.g. Hinglish in Roman script)
```

## P1: Ebook outline generator
```
Using the CLIENT BRIEF below, create an ebook outline.
Constraints:
- Title: max 7 words + a subtitle that states the transformation
- 7–9 chapters, total 15–20 pages (~4,500–6,000 words)
- Each chapter: title, the reader's problem at the start, 3–5 sub-points, 1 practical exercise/checklist, 1 "quick win"
- Chapter 1 must produce a quick win within 24 hours of reading
- Final chapter: next step that naturally leads to the creator's higher-priced offer ({{upsell_offer}})
- Language: {{language}}; tone matches the voice samples
- No unverifiable statistics; mark any fact that needs checking with [VERIFY]

CLIENT BRIEF:
{{brief}}
```
**Then for each chapter:**
```
Write Chapter {{n}}: "{{chapter_title}}" from the approved outline (pasted below).
~650 words. Short paragraphs (max 3 lines). Use one Indian example (names, ₹, cities).
End with the exercise as a checklist. Write in {{language}} matching these voice samples:
{{voice_samples}}
OUTLINE: {{outline}}
```

## P2: Course module generator (for mini-course / video scripts)
```
Using the CLIENT BRIEF, design a mini-course of {{num_modules}} modules (5–10), each a 6–10 minute video.
For each module give:
- Title + learning outcome ("After this, you can…")
- Hook (first 15 seconds, spoken)
- Talking-point script in {{language}}, conversational, with [B-ROLL] and [SCREEN] cues
- One homework task
- One line that teases the next module
Also give: course name, 3 price-point options in INR, and a 1-paragraph course description.
CLIENT BRIEF: {{brief}}
```

## P3: Sales page copy generator
Output maps 1:1 to `01-sales-page/components/site.ts`, so paste it straight in.
```
Write sales-page copy for the product below, for Indian Instagram buyers on mobile.
Return valid TypeScript for an object with these keys exactly:
hero {eyebrow, headline (max 12 words, in {{language}}), sub (max 30 words), primaryCta, secondaryCta, trust[3]},
problem {title, points[4] (buyer's own words), solutionTitle, solution},
pillars[4] {days (use "Module 1–2" style), title, body},
faq[5] {q, a} — must include refund policy ("{{refund_policy}}"), access/delivery, and who it's NOT for,
closing {title, sub}.
Rules: no income or health guarantees, no fake scarcity, no invented testimonials.
Price: ₹{{price}}. Product: {{product_summary}}. Brief: {{brief}}
```

## P4: WhatsApp nurture sequence generator
```
Write a WhatsApp message sequence for {{creator_name}}'s product "{{product_name}}" (₹{{price}}).
Messages:
M0 — instant purchase confirmation + access link {{delivery_link}} (template category: UTILITY)
M1 — Day 1: welcome + "start with chapter/module 1" quick win
M2 — Day 2: common mistake buyers make + fix
M3 — Day 4: mini success story format (leave [REAL STORY] placeholder — do not invent)
M4 — Day 6: ask for feedback / a screenshot of progress
M5 — Day 7: soft upsell to {{upsell_offer}}
A1 — Abandoned checkout, 1 hour after drop: helpful, not pushy, with link {{checkout_link}} (template category: MARKETING)
Rules: each under 450 characters, {{language}}, max 1 emoji per message, one clear action per message,
include {{1}} variable for first name (Meta template format), and a "Reply STOP to opt out" line on marketing messages.
```

## P5: Instagram launch posts generator
```
Create a 7-day Instagram launch plan for "{{product_name}}" (₹{{price}}) by {{creator_name}} ({{niche}}).
For each day: format (reel/carousel/story/live), hook (first line, max 10 words), full caption in {{language}},
CTA, and 3 story frames (text + sticker type: poll/quiz/link/countdown).
Day 1 tease → Day 2 problem → Day 3 behind-the-scenes → Day 4 LAUNCH (link) → Day 5 FAQ/objections →
Day 6 early buyer reactions ([REAL] placeholder) → Day 7 last-call (only if a real deadline exists: {{deadline}}).
Also give 15 niche hashtags (mix 5 large, 5 medium, 5 small) and a pinned-comment text.
```

## P6: QA pass (run before sending anything to the client)
```
Review the content below as a strict editor for an Indian audience. Flag:
1. Any income, health, medical or financial guarantee or SEBI-sensitive advice
2. Any invented testimonial, statistic or fake urgency
3. Anything that doesn't sound like these voice samples: {{voice_samples}}
4. Typos, repetition, sentences over 25 words
Return a table: issue | exact line | fix. Then the corrected full text.
CONTENT: {{content}}
```
