# Week 1 Execution Checklist: Wed 11 Nov to Tue 17 Nov 2026

**Time budget:** morning 5:00–6:00 (1 h) + evening 7:00–10:00 (3 h) = 4 h/day on 6 days, and
Sunday is lighter. **Total ≈ 24 h**, inside your 25 h cap.

**An honest revenue expectation for Week 1: ₹0 collected.** The goal of Week 1 is a working system
plus **5 booked sales calls**. With normal cold-DM conversion, the first advance (₹24,500) usually lands in
**Week 2–3**. Anyone who promises a sale in 7 days from zero is guessing.

### The numbers that matter (your "funnel")
A *funnel* is the chain from stranger to paying client. Typical cold-DM rates for a new sender:

| Stage | Rate | Week 1 target | Weeks 1–3 target |
|---|---|---|---|
| DMs sent | | 80 | 300 |
| Replies | 10–15% | 10 | 35 |
| Calls booked | 30–40% of replies | 4–5 | 12 |
| Clients closed | 15–25% of calls | 0–1 | 2–3 |

---

## Day 1 · Wed 11 Nov · Foundation
**Morning (5:00–6:00)**
- [ ] 20 min: read `12-business-setup/business-setup-checklist.md` **section 0 (BSF rules)** fully. Decide who the proprietor is (see the decision checkpoint below)
- [ ] 40 min: talk to the family member who will be the proprietor. List the documents they need (PAN, Aadhaar, bank account, phone)

**Evening (7:00–10:00)**
- [ ] 60 min: Razorpay signup **in the proprietor's name**, then submit KYC. Approval takes 2–5 days, which is why it's Day 1
- [ ] 45 min: edit `01-sales-page/components/site.ts` (brand name, proprietor line). Run locally
- [ ] 30 min: deploy with `npx vercel --prod` and save the URL
- [ ] 45 min: Calendly free account → 15-min "Launch Strategy Call" event, slots only **7:30–9:30 PM**. Add the URL to Vercel env vars

🔶 **Decision checkpoint:** is the proprietor confirmed *and* are they willing to sign contracts and hold the bank account? If not, stop and solve this before taking any money.

## Day 2 · Thu 12 Nov · Profile + offer
**Morning**
- [ ] 60 min: set up the Instagram business profile: name "[Brand] | Digital Product Launches", bio ("10 din mein aapka course/ebook live 🚀 · Done-for-you · 3 slots/month"), sales-page link

**Evening**
- [ ] 90 min: build your **demo product**, the one real asset you have before clients. Pick a niche you know (fitness or career). Use `06-prompt-library` to make a 15-page sample ebook + a demo sales page (copy of `01-sales-page` with fake-brand content clearly labelled "DEMO"). This is your portfolio
- [ ] 60 min: post 3 Instagram posts: (1) "What I do", (2) a demo walkthrough carousel, (3) a reel screen-recording the demo sales page + Razorpay test checkout
- [ ] 30 min: read the 30 DM scripts once, out loud

## Day 3 · Fri 13 Nov · First leads + test DMs
**Morning**
- [ ] 60 min: research **10 leads** (`09-lead-tracker/README.md` qualification check). Fill the CSV

**Evening**
- [ ] 60 min: research 15 more leads (25 total)
- [ ] 60 min: warm-up: follow + leave 1 genuine comment on all 25
- [ ] 45 min: **send 10 test DMs** (5 × C1, 5 × C5). Log them in the CSV
- [ ] 15 min: import the CSV into Google Sheets

## Day 4 · Sat 14 Nov · Lead list complete
**Morning**
- [ ] 60 min: reply to any responses. Research 10 leads (35 total)

**Evening**
- [ ] 90 min: research 15 leads, **50 total** ✅
- [ ] 45 min: warm-up comments on the new 25
- [ ] 45 min: practise the sales call script (`04-sales-call`) out loud twice, recording on your phone

🔶 **Decision checkpoint:** did any of the 10 test DMs get a reply? If 0/10, rewrite line 1 to be more specific to each person's post, not the template.

## Day 5 · Sun 15 Nov · Light day (2 h)
- [ ] 30 min (morning): Interakt / WhatsApp API: create a trial account only (don't pay yet)
- [ ] 60 min (evening): n8n Cloud trial **or** self-host test (see `07-n8n-workflows/README.md`). Import workflow 03 (purchase → delivery) and test it with Razorpay test mode
- [ ] 30 min: weekly review, filling in `11-dashboard`

## Day 6 · Mon 16 Nov · Full DM volume begins
**Morning**
- [ ] 60 min: **20 DMs** (mix C1/C2/C4). Log them

**Evening**
- [ ] 30 min: reply to everyone who answered. Push replies toward a Calendly link (script O8)
- [ ] 60 min: send follow-ups F1 to everyone from Friday with no reply
- [ ] 60 min: 10 more leads + 1 Instagram post ("Behind the scenes: building a coach's sales page")
- [ ] 30 min: Hunter.io/bio emails: send 5 cold emails (`03-email-templates`, E1)

## Day 7 · Tue 17 Nov · Calls + review
**Morning**
- [ ] 60 min: 20 DMs + replies

**Evening**
- [ ] 7:30–9:30: **sales calls** (target: 2 by tonight)
- [ ] 30 min: send the proposal + Razorpay link within 1 hour of every good call
- [ ] 30 min: week review: DMs sent, reply %, calls booked. Update the dashboard

🔶 **End-of-week checkpoint**
| If… | Then… |
|---|---|
| Reply rate < 5% | Your opener is the problem. Switch to C2 (free idea) for everyone next week |
| Replies OK but no calls | Your 2nd message is the problem. Send the Calendly link sooner and offer 2 specific times |
| Calls but no close | Price/trust is the problem. Offer the Lite ₹29K package (O3) or milestone payments of 3 × ₹16,333 |
| 1+ client closed 🎉 | Stop DMing for 2 days and **over-deliver** on client 1. Their result is your next 10 sales |

---

## Daily non-negotiables (every day, 15 min total)
- [ ] Reply to every DM within 12 hours (morning + evening check)
- [ ] Log every DM/reply in the tracker the same day
- [ ] One Instagram story showing what you're working on (builds trust with prospects who check your profile)

## Things you must NOT do in Week 1
- Don't pay for any tool before your first advance arrives. Use free tiers and trials
- Don't send more than ~25 cold DMs/day from one account
- Don't take any payment into **your own** bank account or UPI ID
