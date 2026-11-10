"use client";

import { useEffect, useRef } from "react";

/**
 * Razorpay Payment Button (no backend needed).
 * Create the button in Razorpay Dashboard > Payment Button > "Create Payment Button",
 * set amount ₹24,500 (fixed), then put its ID in NEXT_PUBLIC_RAZORPAY_BUTTON_ID.
 * Razorpay requires the <script> to live INSIDE a <form>, so we inject it on mount.
 */
export default function RazorpayButton() {
  const formRef = useRef<HTMLFormElement>(null);
  const buttonId = process.env.NEXT_PUBLIC_RAZORPAY_BUTTON_ID;
  const configured = !!buttonId && !buttonId.includes("XXXX");

  useEffect(() => {
    const form = formRef.current;
    if (!form || !configured || form.querySelector("script")) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/payment-button.js";
    s.async = true;
    s.dataset.payment_button_id = buttonId!;
    form.appendChild(s);
  }, [buttonId, configured]);

  if (!configured) {
    return (
      <div className="rounded-xl border-2 border-dashed border-saffron/50 bg-saffron-light p-4 text-sm">
        <span className="placeholder-tag">Setup needed</span>
        <p className="mt-2">
          Razorpay button yahan dikhega. <code>NEXT_PUBLIC_RAZORPAY_BUTTON_ID</code> set karo (README dekho).
        </p>
      </div>
    );
  }
  return <form ref={formRef} aria-label="Pay ₹24,500 advance with Razorpay" />;
}
