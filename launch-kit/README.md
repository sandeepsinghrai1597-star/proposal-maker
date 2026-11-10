# Launch Kit: Done-For-You Instagram Infoproduct Launch Service

Everything needed to sell and deliver a ₹49K–₹1.25L "10-day digital product launch" to Indian
Instagram coaches. Built 10 Nov 2026.

| # | Folder | What's inside | Format |
|---|---|---|---|
| 1 | `01-sales-page/` | Deployable Next.js 14 + Tailwind sales page with Razorpay button, Calendly embed, WhatsApp button, and Terms/Privacy/Refund/Contact pages. **Also your client template** | `.tsx` |
| 2 | `02-dm-scripts/` | 30 Hinglish DMs: 10 openers, 10 follow-ups, 10 objection replies, each psychology term explained | `.md` |
| 3 | `03-email-templates/` | 10 cold emails (5 initial, 3 follow-ups, 2 break-ups) + DPDP-safe sending rules | `.md` |
| 4 | `04-sales-call/` | 15-min SPIN-based call script, word for word | `.md` |
| 5 | `05-contract/` | Service agreement (needs lawyer review) | `.md` |
| 6 | `06-prompt-library/` | 7 chained prompts: brief → ebook → course → sales copy → WhatsApp → launch posts → QA | `.md` |
| 7 | `07-n8n-workflows/` | 5 importable n8n workflows (lead capture, abandoned checkout, Razorpay-verified delivery, 7-day nurture, WhatsApp auto-reply) | `.json` |
| 8 | `08-client-onboarding/` | Post-payment welcome doc with a 10-day milestone table | `.md` (PDF-ready) |
| 9 | `09-lead-tracker/` | 50-slot tracker pre-sorted by niche + qualification method | `.csv` |
| 10 | `10-week1-plan/` | Hour-by-hour plan for 11–17 Nov, with decision checkpoints | `.md` |
| 11 | `11-dashboard/` | Offline metrics dashboard: import the CSV, log payments, clients, tasks | `.html` |
| 12 | `12-business-setup/` | Day-0 setup: **BSF rules first**, proprietorship, Razorpay, GST, WhatsApp API, tools | `.md` |

**PDF export:** open any `.md` in VS Code → "Markdown PDF" extension, or paste into Google Docs → Download as PDF.

---

## Assumptions I made (correct me if any are wrong)
1. **Brand name "LaunchIn10" is a placeholder.** Change it in `01-sales-page/components/site.ts`.
2. **Headline softened.** The brief's "₹10L earning product" line is an income claim. Under the Consumer
   Protection Act and ASCI ad guidelines, an unproven income claim is risky, and it's the first thing a
   sceptical coach will push back on. The page promises "product live in 10 days" (which you control) instead.
3. **No fake proof anywhere.** Case studies and testimonials are yellow-tagged placeholders. DM scripts that
   rely on past results are marked *[after 1st client]*.
4. **Lead list = 50 researched slots, not 50 invented handles.** I can't verify live Instagram follower counts
   from here, and guessed handles would waste your Monday. `09-lead-tracker/README.md` gets you 50 verified leads in about 3 hours.
5. **WhatsApp uses the Meta Cloud API directly** (no BSP fee). Interakt is an option per client.
6. **Calls are only 7:30–9:30 PM**, to fit around BSF duty.
7. **n8n workflows are structurally validated, not live-tested.** Test each once before using it for a client.

---

## Summary report

### ⚠️ Risk #1: read before anything else
**The family-proprietor structure doesn't remove the BSF conduct-rule risk.** Rule 15(1) of the CCS
(Conduct) Rules bars engaging in business *"directly or indirectly"* without sanction, and Rule 15(3)
requires you to report a family member's business. If you're the one doing the selling and building, the
paperwork alone may not protect you. Take a 30-minute consult with a service-law advocate and/or apply for
sanction **before the first payment**. Details are in `12-business-setup/` section 0.
Your job and pension are worth far more than this business.

### Next 24 hours (≈4 h)
1. Read the setup checklist, section 0. Decide on the proprietor and book the service-law consult.
2. Open Razorpay in the proprietor's name and submit KYC. **This has the longest wait (2–5 days)**.
3. Edit `site.ts` and `policies.ts`, then `npx vercel --prod`. The sales page goes live.
4. Create the Calendly 15-min event and add both env vars in Vercel.

### Next 7 days
Follow `10-week1-plan/`: build a **demo product** (your only portfolio piece until client #1), research 50 leads,
send ~80 DMs + 5 emails, and book **4–5 sales calls**. Razorpay goes live around Day 4–5.

### Expected first revenue date
- **Realistic: 24 Nov – 5 Dec 2026** (first ₹24,500 advance), assuming ~300 DMs over 2–3 weeks at normal new-sender rates
  (10–15% reply → 30–40% book → 15–25% close).
- Optimistic: a close on a Week-1 call means an advance by **18–20 Nov**.
- I won't promise Month-1 = ₹98K–₹1.47L as in the brief. **2 clients in the first 30 days is a good result**; 3 is excellent.

### Other risks and how to reduce them
| Risk | Likelihood | Mitigation |
|---|---|---|
| **No portfolio means low trust** | High | Demo product + 50-50 payment terms + honest "founder price" framing (C5, E3) |
| **10-day delivery while on duty** (BSF postings, leave cancellations) | High | Take a max of **2 clients at a time**. Write "business days" in the contract. Use the prompt library to cut content time to ~4 h. Keep 2 buffer days per project |
| **Instagram restricts your account** for mass DMs | Medium | ≤25 DMs/day, warm up with comments first, personalise line 1 |
| **Razorpay KYC delay or rejection** | Medium | Apply Day 1; policy pages already built; use Payment Links as a fallback |
| **Coaches' products don't sell** (they blame you) | Medium | Contract says no income guarantee; pick ₹499–₹999 launch prices; push the 7-day launch plan, not one post |
| **Meta template rejections** delay WhatsApp delivery | Medium | Submit templates on Day 7 morning; email delivery runs in parallel as a backup |
| **Clients making health/finance claims** (SEBI, ASCI) | Medium | Clause 6 of the contract + prompt P6 QA pass flags them |
| **Scope creep** ("bas ek aur chhota change") | High | 2 revision rounds, "one message = one round", ₹1,500/h after that |

### What would make the biggest difference
Your first client's **real result** is worth more than everything in this kit. When you close client #1,
pause outreach, over-deliver, get a video testimonial, and replace the placeholders. That's when the
₹75K price becomes believable.
