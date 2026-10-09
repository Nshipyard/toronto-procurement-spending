"use client";

import { useLang } from "@/i18n";
import McpConnect from "./McpConnect";

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/vendor/search?q=furfari&limit=3",
    desc: "Search canonical vendors by name, ranked by total spend",
    response: `{
  "q": "furfari",
  "limit": 3,
  "total": 1,
  "hits": [
    {
      "id": "V00001",
      "n": "Furfari Paving Co. Ltd.",
      "vc": 4, "a": 58, "s": 781673999.74,
      "fy": "2012", "ly": "2018"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/vendor/lookup?vendor_id=V00001",
    desc: "Full vendor record: spend, awards, merged name variants, top awards",
    response: `{
  "id": "V00001",
  "n": "Furfari Paving Co. Ltd.",
  "s": 781673999.74, "a": 58,
  "variants": ["Furfari Paving Co. Ltd.", "FURFARI PAVING CO LTD"],
  "awards": [ { "a": 600600000, "y": "2016",
    "k": "competitive", "c": "Construction Services" } ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/spend/summary",
    desc: "Spend aggregates: top-10 share, competitive split, by year, category, division, reasons",
    response: `{ "meta": { "total_spend": 21520000000, … },
  "top10_share_pct": 20.8,
  "by_kind": { "competitive": { "share_pct": 90.1 }, … },
  "top_vendors": [ … ] }`,
  },
];

export default function Developers() {
  const { t } = useLang();
  return (
    <section id="developers" className="bg-ink text-white">
      <div className="mx-auto max-w-[1392px] px-6 py-20 md:py-28">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/60">{t.developers.kicker}</p>
        <h2 className="display mt-4 max-w-[720px] text-[40px] md:text-[52px]">{t.developers.title}</h2>
        <p className="mt-5 max-w-[720px] text-[18px] leading-relaxed text-white/70">{t.developers.body}</p>

        <h3 className="mt-14 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/60">{t.developers.endpoints}</h3>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {endpoints.map((e) => (
            <article key={e.path} className="flex min-w-0 flex-col rounded-[24px] border border-white/15 bg-white/5 p-6">
              <p className="font-mono text-[12px] font-semibold text-white/60">{e.method}</p>
              <code className="mt-1 break-all font-mono text-[13px] text-white">{e.path}</code>
              <p className="mt-2 text-[14px] text-white/65">{e.desc}</p>
              <pre className="mt-4 flex-1 overflow-x-auto rounded-[16px] bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-white/80">
                {e.response}
              </pre>
              <a
                href={e.path}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block self-start rounded-full border border-white/25 px-5 py-2 text-[14px] font-semibold hover:border-white"
              >
                {t.developers.tryIt} →
              </a>
            </article>
          ))}
        </div>

        <div className="mt-8">
          <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="block rounded-[24px] bg-white/[0.06] p-6 hover:bg-white/[0.09]">
            <h4 className="text-[19px] font-semibold">{t.developers.openapi}</h4>
            <code className="mt-2 block font-mono text-[13px] text-white/60">GET /api/openapi.json</code>
          </a>
        </div>

        <McpConnect
          config={{
            slug: "toronto-procurement",
            displayName: "Toronto Procurement Spending",
            exampleEn: 'Search vendors for "paving" and show me the top result',
            exampleFr: 'Recherche les fournisseurs contenant "paving" et montre-moi le premier résultat',
          }}
        />
      </div>
    </section>
  );
}
