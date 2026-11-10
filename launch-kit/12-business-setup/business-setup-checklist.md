# Day-0 Business Setup Checklist

> Prices and rules below were checked against public sources on **10 Nov 2026**, but they change.
> Confirm each one on the official page before you pay or file.

---

## 0. ⚠️ BSF / government-service rules: read before anything else

Your brief says "family member as proprietor". That structure is **not automatically safe**. I'd be
failing you if I didn't spell out why.

**What the rule says.** BSF personnel are covered by service conduct rules modelled on the
**CCS (Conduct) Rules, 1964, Rule 15**:
- 15(1): no government servant shall, without previous sanction, **"engage directly or indirectly in any trade or business"**.
- 15(3): you must **report to the government** if a family member is engaged in trade or business.
- Exemptions are narrow: honorary social/charitable work, and *occasional* literary, artistic or scientific work.

**Where the risk is.** If your family member is the proprietor on paper, but **you** do the DMs, the
calls, the building and the client communication, that can be read as you "indirectly" running
the business. Putting the paperwork in someone else's name doesn't change who's doing the work.

**What I recommend before taking the first rupee:**
1. **Read your own service rules** (BSF Act/Rules and the conduct rules applied to your cadre) and
   any standing orders on private employment.
2. **Ask for written clarity or sanction.** The safest path is an application to your competent
   authority asking for permission for part-time private work (some government servants get it for
   tech or teaching work). At minimum, file the **Rule 15(3) report** if a family member starts a business.
3. **Get a 30-minute consult** with a lawyer who handles service matters (₹1,000–₹3,000). Ask:
   *"Can my relative run this as proprietor if I contribute technical work? What must I report?"*
4. **Keep your identity out of public selling until that's clear:** no BSF mention, no uniform
   photos, no official phone or email, and no work during duty hours or on government devices.
5. The proprietor must be **genuinely involved**: they sign contracts, own the bank account and
   Razorpay, receive payments and file taxes. Keep a record of what they do.

The setup below assumes you go ahead once this is resolved. **Don't skip step 2.**

---

## 1. Legal entity: sole proprietorship in the family member's name
A sole proprietorship has no formal "registration". It's proven through documents. Choose a
family member who is **not a government servant** (parent, sibling, or spouse; note that a spouse
also triggers your Rule 15(3) reporting).

| Item | What | Cost | Time |
|---|---|---|---|
| Proprietor's PAN + Aadhaar | Already exist (Aadhaar must be linked to their mobile) | ₹0 | — |
| **Udyam Registration** (MSME) | udyamregistration.gov.in, Aadhaar-based, gives a certificate in the trade name | **₹0** (avoid paid agents) | 30 min |
| Trade name | e.g. "LaunchIn10 Digital Services" | ₹0 | — |
| Shop & Establishment (Punjab) | Often needed by banks for a current account; check your municipal rules | ₹0–₹1,000 | 1–7 days |

## 2. Bank account (proprietor's name)
- **Option A (start here):** use the proprietor's existing **savings account**. Razorpay accepts
  individuals/unregistered businesses with a savings account for KYC.
- **Option B (once revenue starts):** a **current account** in the trade name (needs Udyam + one
  more proof, e.g. Shop & Establishment or GST). Zero-balance options: Kotak 811 Current, IDFC FIRST, or Jupiter/Razorpay X partner accounts. Compare minimum-balance rules.
- ❌ Never route client money through **your** salary account or your UPI ID.

## 3. Razorpay account (proprietor's name)
| Step | Detail |
|---|---|
| Sign up | razorpay.com, using the proprietor's email/phone |
| Business type | "Proprietorship" (with Udyam) or "Individual / Not yet registered" |
| KYC docs | Proprietor PAN, Aadhaar, bank account details/cancelled cheque, website URL (your Vercel sales page). The site needs **Contact, Terms, Privacy, Refund** pages, which Razorpay checks |
| Approval | Usually 2–5 working days |
| Fees | Domestic standard **2% + 18% GST on the fee** (≈2.36% effective), no setup fee or AMC. Razorpay has run a 90-day 0% fee offer for new merchants (GMV-capped); check if it's live |
| Products | **Payment Button** (₹24,500 advance) and **Payment Links** (balance payments) |

The sales page already includes `/terms`, `/privacy`, `/refund` and `/contact` pages (edit `01-sales-page/components/policies.ts`).

## 4. GST: do you need it?
- **Not mandatory yet.** For service providers in Punjab the threshold is **₹20 lakh aggregate
  turnover per year**. Interstate supply of services below that threshold also doesn't force registration.
- **Register when** turnover approaches ₹20L (around 4 clients/month at ₹49K), **or** voluntarily
  earlier if a client needs a GST invoice to claim input credit.
- Registering means charging 18% on top, monthly/quarterly returns, and a CA cost of ~₹1,000–₹2,000/month.
- Income tax: it's the **proprietor's** income. They should file an ITR (ITR-3/ITR-4 presumptive under 44ADA for professionals). Ask a CA.

## 5. WhatsApp Business API
| Option | Platform fee | Per-message | Best for |
|---|---|---|---|
| **Meta Cloud API direct** (used in `07-n8n-workflows`) | ₹0 | Meta's per-template rates for India (marketing > utility; service replies in the 24 h window are free) | You (developer); cheapest |
| **Interakt** (by Jio Haptik) | ~₹2,800–₹3,800/month reported for Growth/Advanced tiers; may be quoted on request | Meta rates + markup on some plans | Clients who want a dashboard/inbox |
| **Gupshup / AiSensy / Wati** | Varies | Meta rates + markup | Compare per client |

Setup needs: a Facebook Business Manager (proprietor's), a **fresh phone number** not active on the
normal WhatsApp app, business verification for higher limits, and an approved display name.

## 6. Hosting and tools
| Tool | Plan | Cost | Note |
|---|---|---|---|
| **Vercel** | Hobby | ₹0 | Hobby is for **non-commercial** use. Once you're selling, move to Pro (~$20/mo) or use Netlify/Cloudflare Pages free tiers |
| **Framer** | — | Skip | Not needed. You code in Next.js, which is your advantage |
| **n8n** | Cloud Starter, or self-host on a VPS | ~€20–24/mo, or ₹400–₹900/mo VPS | Start with the Cloud trial. Self-host after client #3 |
| **Calendly** | Free | ₹0 | One event type is enough |
| **Google Workspace / Zoho Mail** | Zoho Mail Lite | ~₹60–₹100/user/mo | A professional email on a domain |
| **Domain** | .in / .com | ₹500–₹1,000/yr | Optional in month 1 |
| **Claude / ChatGPT** | Paid plan | ~₹1,700–₹2,000/mo | For content delivery speed (prompt library) |
| **Bitwarden** | Free | ₹0 | Client credential handling |

**Month-1 cash needed: ≈ ₹0–₹2,500.** Pay for tools only after the first advance lands.

## 7. Paperwork per client
- [ ] Service agreement (`05-contract`) sent and the client replies "Agreed"
- [ ] Advance via Razorpay Payment Button → automatic receipt
- [ ] Invoice in the proprietor's name (Zoho Invoice free / Razorpay invoices)
- [ ] Onboarding doc (`08-client-onboarding`) sent within 1 hour of payment
- [ ] Balance via Razorpay Payment Link on Day 10

---

### Setup order (fastest path)
1. Section 0 resolved → 2. Udyam (30 min) → 3. Razorpay signup + KYC (start the 2–5 day clock) →
4. Sales page live with policy pages → 5. Calendly → 6. Meta Business Manager + WhatsApp number →
7. n8n trial → 8. Zoho/Gmail business email.

### Sources
- [CCS (Conduct) Rules, Rule 15](https://www.referencer.in/cs_regulations/CCS(Conduct)Rules1964/Rule_15.aspx)
- [Razorpay pricing notes](https://razorpay.com/llms.txt) · [Razorpay cheapest-gateway blog](https://razorpay.com/blog/cheapest-payment-gateway-for-businesses-in-india/)
- [Interakt vs Wati 2026 pricing (RichAutomate)](https://richautomate.in/blog/interakt-vs-wati-india-2026-pricing-decoded) · [Interakt pricing (Capterra)](https://www.capterra.com/p/241014/Interakt/pricing)
