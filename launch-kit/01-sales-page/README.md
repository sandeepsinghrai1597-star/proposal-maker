# Sales Page — Next.js 14 + Tailwind (deploy to Vercel)

## 1. Edit the copy (10 min)
Every word, price and placeholder lives in **`components/site.ts`**. Change the brand name,
proprietor line (family member's name), and later replace the `[PLACEHOLDER]` case studies and
testimonials with **real** ones. The page shows yellow "Placeholder" tags until you remove them.

## 2. Create the Razorpay button (15 min, after KYC is approved)
1. Razorpay Dashboard → **Payment Button** → Create → *Buy Now* template.
2. Amount: **Fixed ₹24,500**, title "Launch Service – 50% Advance".
3. Customer fields: Name, Email, Phone, Instagram handle (custom field).
4. Copy the button ID (`pl_...`).

## 3. Set environment variables
```bash
cp .env.example .env.local     # then fill the 3 values
```
| Var | What |
|---|---|
| `NEXT_PUBLIC_RAZORPAY_BUTTON_ID` | `pl_...` from step 2 |
| `NEXT_PUBLIC_CALENDLY_URL` | e.g. `https://calendly.com/yourname/15min` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `91XXXXXXXXXX` (no +) — shows the floating WhatsApp button |

Until these are set the page shows clear setup placeholders instead of broken widgets.

## 4. Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## 5. Deploy (one command)
```bash
npx vercel --prod
```
First time it asks you to log in and link a project — accept the defaults. Then add the same
3 env vars in **Vercel → Project → Settings → Environment Variables** and redeploy
(`npx vercel --prod` again). Optional: add a custom domain under **Settings → Domains**.

## Notes
- Static page, no backend, no database — Vercel Hobby (free) is enough.
- Vercel's Hobby plan is for non-commercial use; once you are taking client payments,
  move this project to Pro ($20/mo) or host on Netlify/Cloudflare Pages free tiers.
- Razorpay's domestic fee is ~2% + 18% GST on that fee (~2.36% effective) — on ₹24,500 that's ≈ ₹578.
- The same codebase is your **client template**: copy the folder, change `site.ts`, swap the
  Razorpay button for the client's product price. That's Day 4–6 of delivery.
