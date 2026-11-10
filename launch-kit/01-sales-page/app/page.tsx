import { site, inr } from "@/components/site";
import RazorpayButton from "@/components/RazorpayButton";
import CalendlyEmbed from "@/components/CalendlyEmbed";
import WhatsAppFab from "@/components/WhatsAppFab";

export default function Page() {
  const { hero, problem, pillars, caseStudies, anchor, testimonials, faq, closing } = site;
  const aloneTotal = anchor.rows.reduce((s, r) => s + r.alone, 0);

  return (
    <main>
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="container-x flex h-14 items-center justify-between">
          <span className="font-display text-xl font-bold">{site.brand}</span>
          <a href="#book" className="btn-primary !px-4 !py-2 text-sm">
            Call book karo
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="container-x py-16 sm:py-24">
        <p className="eyebrow">{hero.eyebrow}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[1.1] sm:text-6xl">{hero.headline}</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink/75">{hero.sub}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#book" className="btn-primary">{hero.primaryCta}</a>
          <a href="#results" className="btn-ghost">{hero.secondaryCta}</a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
          {hero.trust.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-leaf" /> {t}
            </li>
          ))}
        </ul>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="bg-ink py-16 text-paper sm:py-20">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow !text-saffron">The problem</p>
            <h2 className="h2 mt-3">{problem.title}</h2>
            <ul className="mt-6 space-y-4">
              {problem.points.map((p) => (
                <li key={p} className="flex gap-3 text-paper/85">
                  <span className="mt-1 text-saffron">✕</span> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-paper/5 p-6 ring-1 ring-paper/10 sm:p-8">
            <p className="eyebrow !text-saffron">The fix</p>
            <h3 className="mt-3 font-display text-2xl sm:text-3xl">{problem.solutionTitle}</h3>
            <p className="mt-4 text-paper/80">{problem.solution}</p>
          </div>
        </div>
      </section>

      {/* 4 PILLARS */}
      <section className="container-x py-16 sm:py-20">
        <p className="eyebrow">What you get in 10 days</p>
        <h2 className="h2 mt-3">4 pillars. 10 business days. Ek price.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <div key={p.title} className="card">
              <span className="text-sm font-semibold text-saffron-dark">{p.days}</span>
              <h3 className="mt-2 font-display text-xl">
                {i + 1}. {p.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/75">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CASE STUDIES */}
      <section id="results" className="bg-saffron-light py-16 sm:py-20">
        <div className="container-x">
          <p className="eyebrow">Results</p>
          <h2 className="h2 mt-3">Case studies</h2>
          <p className="mt-2 text-sm text-ink/60">
            <span className="placeholder-tag">Placeholder</span> Real client results will replace these.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {caseStudies.map((c) => (
              <article key={c.handle} className="card">
                <p className="text-sm text-ink/60">{c.niche}</p>
                <h3 className="mt-1 font-display text-xl">{c.name}</h3>
                <p className="text-sm text-ink/60">{c.handle}</p>
                <p className="mt-4 text-sm"><b>Product:</b> {c.product}</p>
                <p className="mt-1 font-display text-2xl text-leaf">{c.result}</p>
                <p className="mt-4 border-l-2 border-saffron pl-3 text-sm italic text-ink/75">{c.quote}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRICE ANCHOR */}
      <section id="pricing" className="container-x py-16 sm:py-20">
        <p className="eyebrow">Pricing</p>
        <h2 className="h2 mt-3">{anchor.title}</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="card lg:col-span-3">
            <table className="w-full text-left text-sm">
              <tbody>
                {anchor.rows.map((r) => (
                  <tr key={r.item} className="border-b border-ink/10 last:border-0">
                    <td className="py-3 pr-4">{r.item}</td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {r.alone ? inr(r.alone) : r.note}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-4 font-semibold">Alag-alag hire karne ka total</td>
                  <td className="pt-4 text-right font-display text-2xl tabular-nums line-through decoration-saffron">
                    {inr(aloneTotal)}+
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-ink/50">Typical market quotes for hiring each piece separately. Your results may vary.</p>
          </div>
          <div className="card border-2 border-saffron lg:col-span-2">
            <span className="rounded-full bg-saffron px-3 py-1 text-xs font-bold uppercase text-white">Early bird</span>
            <p className="mt-4 text-sm text-ink/60 line-through">{inr(anchor.standardPrice)}</p>
            <p className="font-display text-5xl">{inr(anchor.yourPrice)}</p>
            <p className="mt-2 text-sm text-ink/70">
              Aaj sirf <b>{inr(anchor.advance)}</b> advance. Baaki {inr(anchor.yourPrice - anchor.advance)} Day 10 delivery pe.
            </p>
            <p className="mt-3 text-sm font-medium text-saffron-dark">{anchor.seatsNote}</p>
            <div className="mt-6">
              <RazorpayButton />
            </div>
            <p className="mt-3 text-xs text-ink/50">
              Recommended: pehle call book karo, phir pay karo — taaki hum confirm kar sakein ki aap fit ho.
            </p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container-x">
          <p className="eyebrow">Testimonials</p>
          <h2 className="h2 mt-3">Coaches kya kehte hain</h2>
          <p className="mt-2 text-sm text-ink/60"><span className="placeholder-tag">Placeholder</span></p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="card bg-paper">
                <blockquote className="text-ink/80">“{t.text}”</blockquote>
                <figcaption className="mt-4 text-sm">
                  <b>{t.name}</b> <span className="text-ink/60">· {t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x py-16 sm:py-20">
        <p className="eyebrow">FAQ</p>
        <h2 className="h2 mt-3">Aapke sawaal</h2>
        <div className="mt-8 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white">
          {faq.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="text-saffron transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink/75">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* BOOK */}
      <section id="book" className="bg-ink py-16 text-paper sm:py-20">
        <div className="container-x grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow !text-saffron">Next step</p>
            <h2 className="h2 mt-3">{closing.title}</h2>
            <p className="mt-4 text-paper/80">{closing.sub}</p>
            <ol className="mt-6 space-y-3 text-paper/85">
              <li>1. 15-min call book karo</li>
              <li>2. Hum aapka product idea + price point decide karte hain</li>
              <li>3. Fit hai toh ₹24,500 advance → Day 1 shuru</li>
            </ol>
          </div>
          <div className="lg:col-span-3">
            <CalendlyEmbed />
          </div>
        </div>
      </section>

      <footer className="container-x py-8 text-xs text-ink/50">
        <nav className="mb-3 flex flex-wrap gap-4 text-ink/70">
          <a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund">Refund policy</a><a href="/contact">Contact</a>
        </nav>
        <p>{site.proprietorLine}</p>
        <p className="mt-1">© {new Date().getFullYear()} {site.brand}. Results depend on your audience and offer; no income is guaranteed.</p>
      </footer>
      <WhatsAppFab />
    </main>
  );
}
