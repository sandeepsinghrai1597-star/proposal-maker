// Policy pages required for Razorpay KYC. Replace [brackets]. Not legal advice — have them reviewed.
export const policies: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms & Conditions",
    body: [
      "These terms govern services offered by [Trade Name], a sole proprietorship of [Proprietor Name], [Address] (“we”).",
      "Services: done-for-you digital product launch setup as described on this website. The exact scope, timeline and fees for each client are set out in a written Service Agreement, which prevails over this page.",
      "Payments: 50% advance to start, 50% on delivery, via Razorpay. Prices are in INR and exclude GST unless stated.",
      "No guarantee of results: we do not guarantee any sales, income or follower growth.",
      "Intellectual property: clients own their final content after full payment; we retain our templates, code and workflows.",
      "Governing law: India. Courts at [City, State] have exclusive jurisdiction.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      "We collect the name, email, phone number and Instagram handle you share with us through forms, calls, WhatsApp or payment, only to provide and communicate about our services.",
      "Payments are processed by Razorpay; we never see or store your card or bank details.",
      "We do not sell your data. We share it only with service providers needed to deliver our work (e.g. hosting, email, WhatsApp Business API, payment processing).",
      "You can ask us to access, correct or delete your data at any time by emailing [email]. We respond within 30 days.",
      "This policy follows the Digital Personal Data Protection Act, 2023. Grievance contact: [Proprietor Name], [email].",
    ],
  },
  refund: {
    title: "Refund & Cancellation Policy",
    body: [
      "Advance payments secure your project slot. You may cancel for a full refund before Day 1 work begins.",
      "Once work has begun, the advance is non-refundable, and all work completed up to cancellation is delivered to you.",
      "If we fail to deliver the agreed scope within the agreed timeline (after any client-caused delays), you may cancel and we will refund the advance less the value of deliverables already accepted, as set out in the Service Agreement.",
      "Approved refunds are processed to the original payment method within 7 working days.",
      "To request a cancellation or refund, email [email] with your payment ID.",
    ],
  },
  contact: {
    title: "Contact Us",
    body: [
      "[Trade Name] — Sole Proprietor: [Proprietor Name]",
      "Address: [Full address, City, Punjab, PIN]",
      "Email: [email] · WhatsApp: [+91 XXXXX XXXXX]",
      "Response time: within 12 hours (Mon–Sat).",
    ],
  },
};
