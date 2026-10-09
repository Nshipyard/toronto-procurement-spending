import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");

export interface TopVendor {
  id: string;
  name: string;
  spend: number;
  awards: number;
  variants: number;
  first_year: string;
  last_year: string;
  share_pct: number;
}
export interface YearRow {
  year: string;
  competitive: number;
  "non-competitive": number;
  consulting: number;
  awards: number;
}
export interface KindRow {
  awards: number;
  spend: number;
  share_pct: number;
}
export interface CategoryRow {
  category: string;
  awards: number;
  spend: number;
}
export interface DivisionRow {
  division: string;
  awards: number;
  spend: number;
}
export interface ReasonRow {
  reason: string;
  awards: number;
  spend: number;
}
export interface RfxRow {
  type: string;
  awards: number;
  spend: number;
}
export interface SummaryMeta {
  retrieved: string;
  total_records: number;
  total_spend: number;
  raw_vendor_names: number;
  canonical_vendors: number;
  fuzzy_merges: number;
  gsin_hint_coverage_pct: number;
  quarantined_records: { source: string; vendor: string; doc: string; raw_value: string; reason: string }[];
  note: string;
}
export interface Summary {
  meta: SummaryMeta;
  top10_share_pct: number;
  by_year: YearRow[];
  by_kind: Record<string, KindRow>;
  by_category: CategoryRow[];
  by_division: DivisionRow[];
  noncomp_reasons: ReasonRow[];
  rfx_types: RfxRow[];
  top_vendors: TopVendor[];
  repeat_winners: Record<string, number>;
  limitations: string[];
}
export interface VendorIndexRow {
  id: string;
  n: string;
  vc: number;
  a: number;
  s: number;
  fy: string;
  ly: string;
  cats: Record<string, number>;
  kinds: Record<string, number>;
}
export interface AwardRow {
  v: string;
  a: number;
  y: string;
  k: string;
  c: string;
  d: string;
  t: string;
  doc: string;
  desc: string;
  g?: { gsin: string; gsin_desc: string; commodity_type: string; confidence: string };
}
export interface VendorDetail extends VendorIndexRow {
  variants: string[];
  awards: AwardRow[];
}

interface Cache {
  summary: Summary;
  vendors: VendorIndexRow[];
  awards: AwardRow[];
  variants: Map<string, { id: string; canonical: string }>;
}

let cache: Cache | null = null;

export function getData(): Cache {
  if (cache) return cache;
  const summary = JSON.parse(fs.readFileSync(path.join(DATA, "summary.json"), "utf8")) as Summary;
  const vendors = JSON.parse(fs.readFileSync(path.join(DATA, "vendors_index.json"), "utf8")) as VendorIndexRow[];
  const awards = JSON.parse(fs.readFileSync(path.join(DATA, "awards_index.json"), "utf8")) as AwardRow[];
  const variants = new Map<string, { id: string; canonical: string }>();
  const lines = fs.readFileSync(path.join(DATA, "vendor_variants.csv"), "utf8").split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // raw names may contain commas; vendor_id is V\d{5}, canonical follows
    const m = line.match(/^(.*),(V\d{5}),(.*),([^,]*)$/);
    if (m) variants.set(m[1].replace(/^"|"$/g, "").trim(), { id: m[2], canonical: m[3].replace(/^"|"$/g, "") });
  }
  cache = { summary, vendors, awards, variants };
  return cache;
}

export function searchVendors(q: string, limit: number): { total: number; hits: VendorIndexRow[] } {
  const { vendors } = getData();
  const needle = q.trim().toLowerCase();
  const scored: { v: VendorIndexRow; score: number }[] = [];
  for (const v of vendors) {
    if (!needle) {
      scored.push({ v, score: v.s });
      continue;
    }
    const name = v.n.toLowerCase();
    const idx = name.indexOf(needle);
    if (idx === -1) continue;
    scored.push({ v, score: idx === 0 ? v.s + 1e12 : v.s });
  }
  scored.sort((a, b) => b.score - a.score);
  return { total: scored.length, hits: scored.slice(0, limit).map((s) => s.v) };
}

export function lookupVendor(vendorId: string): VendorDetail | null {
  const { vendors, awards, variants } = getData();
  const id = vendorId.trim().toUpperCase();
  const v = vendors.find((x) => x.id === id);
  if (!v) return null;
  const varNames: string[] = [];
  for (const [raw, info] of variants) {
    if (info.id === id) varNames.push(raw);
  }
  varNames.sort();
  const va = awards
    .filter((a) => a.v === id)
    .sort((a, b) => b.a - a.a)
    .slice(0, 100);
  return { ...v, variants: varNames, awards: va };
}
