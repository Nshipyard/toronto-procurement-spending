"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/i18n";

interface TopVendor { id: string; name: string; spend: number; awards: number; share_pct: number }
interface YearRow { year: string; competitive: number; "non-competitive": number; consulting: number; awards: number }
interface CatRow { category: string; awards: number; spend: number }
interface ReasonRow { reason: string; awards: number; spend: number }

interface Summary {
  top10_share_pct: number;
  top_vendors: TopVendor[];
  by_year: YearRow[];
  by_kind: Record<string, { awards: number; spend: number; share_pct: number }>;
  by_category: CatRow[];
  noncomp_reasons: ReasonRow[];
  repeat_winners: Record<string, number>;
}

function money(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

export default function Showcase() {
  const { t, lang } = useLang();
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/v1/spend/summary")
      .then((r) => r.json())
      .then(setS);
  }, []);

  if (!s) return null;
  const sc = t.showcase;
  const top15 = s.top_vendors.slice(0, 15);
  const maxTop = Math.max(1, ...top15.map((v) => v.spend));
  const years = s.by_year.filter((y) => /^\d{4}$/.test(y.year) && y.year >= "2012" && y.year <= "2026");
  const maxYear = Math.max(1, ...years.map((y) => y.competitive + y["non-competitive"] + y.consulting));
  const cats = s.by_category.slice(0, 8);
  const maxCat = Math.max(1, ...cats.map((c) => c.spend));
  const reasons = s.noncomp_reasons.slice(0, 8);
  const maxReason = Math.max(1, ...reasons.map((r) => r.spend));
  const kinds = s.by_kind;
  const buckets = ["1", "2-5", "6-20", "21+"];
  const maxBucket = Math.max(1, ...buckets.map((b) => s.repeat_winners[b] ?? 0));

  return (
    <section id="showcase" className="bg-paper">
      <div className="mx-auto max-w-[1392px] px-6 py-20 md:py-28">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-canada">{sc.kicker}</p>
        <h2 className="display mt-4 max-w-[720px] text-[40px] md:text-[52px]">{sc.title}</h2>
        <p className="mt-5 max-w-[720px] text-[18px] leading-relaxed text-ink/70">{sc.body}</p>

        <h3 className="display mt-16 text-[28px] md:text-[34px]">{sc.topTitle}</h3>
        <p className="mt-2 max-w-[720px] text-[15px] text-ink/60">{sc.topSub}</p>
        <div className="mt-8 space-y-3">
          {top15.map((v, i) => (
            <div key={v.id} className="flex items-center gap-4">
              <span className="w-7 shrink-0 font-mono text-[13px] text-ink/40">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[15px] font-medium">{v.name}</p>
                  <p className="shrink-0 font-mono text-[13px] font-semibold text-canada-dark">{money(v.spend)}</p>
                </div>
                <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-ink/5">
                  <div className="h-full rounded-full bg-canada" style={{ width: `${(v.spend / maxTop) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="display mt-20 text-[28px] md:text-[34px]">{sc.splitTitle}</h3>
        <p className="mt-2 max-w-[720px] text-[15px] text-ink/60">{sc.splitBody}</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-3">
          {[
            { k: "competitive", label: sc.competitive },
            { k: "non-competitive", label: sc.noncompetitive },
            { k: "consulting", label: sc.consulting },
          ].map(({ k, label }) => (
            <div key={k} className="bg-paper p-7">
              <p className="display text-[44px] text-canada">{kinds[k]?.share_pct.toFixed(1)}%</p>
              <p className="mt-2 text-[15px] font-medium">{label}</p>
              <p className="mt-1 text-[14px] text-ink/55">
                {money(kinds[k]?.spend ?? 0)} · {(kinds[k]?.awards ?? 0).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {sc.awardsLabel}
              </p>
            </div>
          ))}
        </div>

        <h3 className="display mt-20 text-[28px] md:text-[34px]">{sc.reasonTitle}</h3>
        <p className="mt-2 max-w-[720px] text-[15px] text-ink/60">{sc.reasonSub}</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {reasons.map((r) => (
            <div key={r.reason} className="rounded-[24px] border border-line bg-paper-warm p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold leading-snug">{r.reason}</p>
                <p className="shrink-0 font-mono text-[13px] font-semibold text-canada-dark">{money(r.spend)}</p>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-ink/5">
                <div className="h-full rounded-full bg-ink/60" style={{ width: `${(r.spend / maxReason) * 100}%` }} />
              </div>
              <p className="mt-2 font-mono text-[12px] text-ink/50">
                {r.awards.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {sc.awardsLabel}
              </p>
            </div>
          ))}
        </div>

        <h3 className="display mt-20 text-[28px] md:text-[34px]">{sc.yearTitle}</h3>
        <p className="mt-2 max-w-[720px] text-[15px] text-ink/60">{sc.yearSub}</p>
        <div className="mt-8 flex h-56 items-end gap-1.5 md:gap-2.5">
          {years.map((y) => {
            const tot = y.competitive + y["non-competitive"] + y.consulting;
            return (
              <div key={y.year} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${y.year}: ${money(tot)}`}>
                <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-t-[6px]">
                  <div className="w-full bg-canada/25" style={{ height: `${(y.consulting / maxYear) * 100}%` }} />
                  <div className="w-full bg-ink/45" style={{ height: `${(y["non-competitive"] / maxYear) * 100}%` }} />
                  <div className="w-full bg-canada" style={{ height: `${(y.competitive / maxYear) * 100}%` }} />
                </div>
                <span className="font-mono text-[10px] text-ink/45 md:text-[11px]">{y.year.slice(2)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-[13px] text-ink/60">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-canada" />{sc.competitive}</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-ink/45" />{sc.noncompetitive}</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-canada/25" />{sc.consulting}</span>
        </div>

        <h3 className="display mt-20 text-[28px] md:text-[34px]">{sc.catTitle}</h3>
        <p className="mt-2 max-w-[720px] text-[15px] text-ink/60">{sc.catSub}</p>
        <div className="mt-8 space-y-3">
          {cats.map((c) => (
            <div key={c.category} className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[15px] font-medium">{c.category}</p>
                  <p className="shrink-0 font-mono text-[13px] font-semibold text-canada-dark">{money(c.spend)}</p>
                </div>
                <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-ink/5">
                  <div className="h-full rounded-full bg-ink/55" style={{ width: `${(c.spend / maxCat) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="display mt-20 text-[28px] md:text-[34px]">{sc.repeatTitle}</h3>
        <p className="mt-2 max-w-[720px] text-[15px] text-ink/60">{sc.repeatBody}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {buckets.map((b, i) => (
            <div key={b} className="rounded-[24px] border border-line bg-paper-warm p-6">
              <p className="display text-[40px] text-canada">
                {(s.repeat_winners[b] ?? 0).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}
              </p>
              <p className="mt-1 text-[14px] font-medium">{sc.bucketLabels[i]}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/5">
                <div className="h-full rounded-full bg-canada" style={{ width: `${((s.repeat_winners[b] ?? 0) / maxBucket) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
