"use client";

import { useEffect } from "react";

export default function CalendlyEmbed() {
  const url = process.env.NEXT_PUBLIC_CALENDLY_URL;
  const configured = !!url && !url.includes("your-handle");

  useEffect(() => {
    if (!configured || document.getElementById("calendly-widget-js")) return;
    const s = document.createElement("script");
    s.id = "calendly-widget-js";
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
  }, [configured]);

  if (!configured) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border-2 border-dashed border-ink/20 bg-white p-6 text-center">
        <div>
          <span className="placeholder-tag">Calendly placeholder</span>
          <p className="mt-3 text-ink/70">
            Set <code>NEXT_PUBLIC_CALENDLY_URL</code> to show your booking calendar here.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="calendly-inline-widget overflow-hidden rounded-2xl border border-ink/10 bg-white"
      data-url={`${url}?hide_gdpr_banner=1&primary_color=e8590c`}
      style={{ minWidth: 300, height: 680 }}
    />
  );
}
