# n8n Workflow Blueprints

Five importable workflows. In n8n go to **Workflows → Import from File** and pick the `.json`.

| File | Trigger | What it does |
|---|---|---|
| `01-lead-capture-crm-welcome.json` | `POST /webhook/lead` | Lead → Google Sheet "Leads" → welcome email → WhatsApp welcome template |
| `02-abandoned-checkout-recovery.json` | `POST /webhook/checkout-started` | Waits 60 min → checks "Purchases" sheet → WhatsApp reminder if not bought |
| `03-purchase-confirmation-delivery.json` | Razorpay webhook `payment.captured` | **Verifies the Razorpay signature** → logs purchase → WhatsApp + email delivery → starts nurture |
| `04-post-launch-7-day-nurture.json` | `POST /webhook/nurture-start` | Day 1, 2, 4, 6 and 7 WhatsApp messages with Wait nodes |
| `05-whatsapp-business-api-automation.json` | Meta webhook `/webhook/whatsapp` | Keyword auto-replies (price / link / hi / stop), forwards everything else to your WhatsApp |

## Setup (once per client, ~45 min)
1. **Edit the `Config` node** in each workflow: Sheet URL, Meta phone-number ID, links, secrets.
2. **Google Sheet** with two tabs:
   - `Leads`: `date, name, email, phone, instagram, source, status`
   - `Purchases`: `date, payment_id, name, email, phone, amount_inr, product`
3. **Credentials** (n8n → Credentials):
   - Google Sheets OAuth2, on every Sheets node
   - SMTP (Zoho Mail/Gmail app password), on the email nodes
   - **Header Auth**, name `Authorization`, value `Bearer <Meta permanent access token>`, on every WhatsApp HTTP node
4. **WhatsApp templates:** create and get approval in Meta Business Manager → WhatsApp Manager → Message templates. Names used:
   `lead_welcome`, `checkout_reminder`, `purchase_delivery`, `nurture_d1`, `nurture_d2`, `nurture_d4`, `nurture_d6`, `nurture_d7`.
   Write the texts with prompt **P4** in `06-prompt-library`. Approval usually takes minutes to a few hours.
5. **Razorpay webhook:** Dashboard → Settings → Webhooks → URL `https://<your-n8n>/webhook/razorpay`, event `payment.captured`, and set a secret (paste it into workflow 03's Config).
6. Activate the workflows. Test with Razorpay **Test Mode** and a ₹1 product first.

## Hosting choice (pick one)
| Option | Cost | When |
|---|---|---|
| **n8n Cloud** (Starter) | ~€20–24/month (check n8n.io/pricing) | Easiest; no server work; good for months 1–2 |
| **Self-hosted on a VPS** (Hostinger / Hetzner / DigitalOcean, Docker) | ~₹400–₹900/month | Cheaper once you have 3+ clients; one instance can run all clients' workflows (separate workflows per client) |

Self-hosting note: workflow 03 uses Node's `crypto` module. Set `NODE_FUNCTION_ALLOW_BUILTIN=crypto` in the n8n environment.

## WhatsApp: direct Meta Cloud API vs Interakt/Gupshup
These workflows call the **Meta WhatsApp Cloud API directly** (`graph.facebook.com`). That avoids a
BSP subscription, so you only pay Meta's per-message charges (utility/marketing templates are charged per message
in India; replies inside the 24-hour customer-service window are free). If a client prefers
Interakt (₹2,500–₹3,500/month range, plus per-message fees; check current pricing), point Interakt's webhook to workflow 05 and replace
the HTTP nodes with Interakt's "send template" API call.

## Known limits (be honest with clients)
- Razorpay Payment Buttons don't send a "checkout started" event. Workflow 02 needs the sales page
  (or a short pre-checkout form) to POST the visitor's phone/email first.
- Marketing templates need the buyer's opt-in. Add a checkbox ("WhatsApp pe updates chahiye") on the form.
- I generated and structurally validated these files (node names, connections) but have **not** run them in a live n8n instance.
  Do one full test run per workflow before using them for a client. Expect to re-select credentials after import.
