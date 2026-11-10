import { notFound } from "next/navigation";
import { policies } from "@/components/policies";
import { site } from "@/components/site";

export function generateStaticParams() {
  return Object.keys(policies).map((policy) => ({ policy }));
}
export const dynamicParams = false;

export function generateMetadata({ params }: { params: { policy: string } }) {
  const p = policies[params.policy];
  return { title: p ? `${p.title} — ${site.brand}` : site.brand };
}

export default function PolicyPage({ params }: { params: { policy: string } }) {
  const p = policies[params.policy];
  if (!p) notFound();
  return (
    <main className="container-x max-w-3xl py-12">
      <a href="/" className="text-sm text-saffron-dark">← {site.brand}</a>
      <h1 className="mt-4 font-display text-3xl">{p.title}</h1>
      <p className="mt-1 text-xs text-ink/50">Last updated: [DD Month YYYY]</p>
      <div className="mt-6 space-y-4 text-ink/80">
        {p.body.map((para) => <p key={para}>{para}</p>)}
      </div>
    </main>
  );
}
