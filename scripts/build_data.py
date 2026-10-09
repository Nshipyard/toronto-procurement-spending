#!/usr/bin/env python3
"""Build derived data for toronto-procurement-spending from City of Toronto
open-data procurement files.

Inputs (data/raw/, NOT committed):
  awarded-contracts.csv          CKAN datastore dump, tobids-awarded-contracts
  noncompetitive-contracts.csv   CKAN datastore dump, tobids-non-competitive-contracts
  consulting-YYYY.xlsx           consulting-services-expenditures (4 files, 2012-2024)
  capital-project-pipeline.csv   capital-project-pipeline (planned work, NOT in spend totals)

Outputs (committed):
  data/summary.json              aggregates + meta + methodology notes
  data/vendors_index.json        canonical vendor entities (trimmed, for search)
  data/awards_index.json         trimmed award records with canonical vendor_id
  data/vendor_variants.csv       raw supplier name -> vendor_id (entity resolution table)
  public/data/vendor_variants.csv, public/data/summary.json  (downloadable copies)

Vendor entity resolution method (documented, deterministic):
  1. Normalize: uppercase, '&' -> 'AND', strip punctuation, collapse whitespace,
     drop legal-entity suffixes (LTD, LIMITED, INC, INCORPORATED, CORP,
     CORPORATION, CO, COMPANY, LLC, LLP, LP, PLC, ULC, LTEE).
  2. Exact match on the normalized key forms the first clustering.
  3. Fuzzy pass: merge keys whose normalized forms have difflib ratio >= 0.93
     AND share the same first token, union-find. Every merge is logged to
     data/vendor_merges.json for audit.
  4. Canonical name = most frequent raw variant; ties broken by longest.
  5. Vendor IDs (V00001...) assigned by total spend descending. IDs are
     regenerated on each rebuild; the variant table is the stable join key.

Commodity: Toronto publishes no commodity codes on award records. The
High Level Category (Construction Services / Goods and Services /
Professional Services) is the primary commodity dimension. A heuristic
keyword match against the federal GSIN table (toronto-civic-codebooks,
4,909 codes) produces a gsin_hint with confidence high|low|none; it is a
suggestion only, never a classification. Coverage is reported honestly.
"""

import csv
import json
import os
import re
import zipfile
from collections import Counter, defaultdict
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(HERE, "data", "raw")
DATA = os.path.join(HERE, "data")
GSIN_CSV = os.path.expanduser(
    "~/workspace/toronto-civic-codebooks/data/procurement_codes.csv")

RETRIEVED = "2026-10-08"

LEGAL_SUFFIXES = {
    "LTD", "LIMITED", "INC", "INCORPORATED", "CORP", "CORPORATION",
    "CO", "COMPANY", "LLC", "LLP", "LP", "PLC", "ULC", "LTEE", "LTÉE",
}

# Source files spell the same category several ways; normalize for display.
CATEGORY_FIX = {
    "TECHNICAL": "Technical",
    "MGMT/R&D": "Management / Research & Development",
    "Legal (External Lawyers & Planners)": "Legal",
    "Work already completed": "Work Already Completed",
    "Health & Safety Issue": "Health & Safety Issues",
    "Scarcity of market supply": "Scarcity of Market Supply",
    "Competitive Solicitation Unsuccessful":
        "Competitive solicitation unsuccessful",
    "Absence of competition": "Absence of Competition",
    "Goods & Services": "Goods and Services",
}


def fix_category(c):
    return CATEGORY_FIX.get((c or "").strip(), (c or "").strip())


def normalize_vendor(name):
    """Normalize a vendor name for entity resolution."""
    if not name:
        return ""
    s = name.upper().strip()
    s = s.replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    toks = s.split()
    while toks and toks[-1] in LEGAL_SUFFIXES:
        toks.pop()
    if toks and toks[0] == "THE":
        toks = toks[1:]
    return " ".join(toks)


def parse_amount(s):
    s = (s or "")
    if not isinstance(s, str):
        s = str(s)
    s = s.replace(",", "").replace("$", "").strip()
    try:
        v = float(s)
        return v if v >= 0 else 0.0
    except ValueError:
        return 0.0


QUARANTINED = []


def quarantine_check(raw_value, vendor, doc, source):
    """Quarantine source defects: a bare 10-digit integer in a currency
    field is a phone number, not an amount (e.g. 9054510208 as $9.05B).
    Returns True when the record must be excluded from all aggregates."""
    if re.fullmatch(r"\d{10}", (raw_value or "").strip()):
        QUARANTINED.append({
            "source": source, "vendor": vendor.strip(), "doc": doc.strip(),
            "raw_value": raw_value.strip(),
            "reason": "10-digit unformatted integer in the amount field; "
                      "matches a phone-number pattern, not a credible award",
        })
        return True
    return False


def load_awarded():
    recs = []
    with open(os.path.join(RAW, "awarded-contracts.csv"),
              encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            vendor = (r.get("Successful Supplier") or "").strip()
            doc = (r.get("Document Number") or "").strip()
            if quarantine_check(r.get("Award"), vendor, doc,
                                "tobids-awarded-contracts"):
                continue
            recs.append({
                "vendor_raw": vendor,
                "amount": parse_amount(r.get("Award")),
                "date": (r.get("Award Authority Obtained Date") or "").strip(),
                "kind": "competitive",
                "category": fix_category(r.get("High Level Category"))
                or "Uncategorized",
                "type": (r.get("RFx (Solicitation) Type") or "").strip(),
                "division": (r.get("Division") or "").strip(),
                "description": (r.get("Solicitation Document Description")
                                or "").strip(),
                "doc": (r.get("Document Number") or "").strip(),
                "reason": "",
            })
    return recs


def load_noncompetitive():
    recs = []
    with open(os.path.join(RAW, "noncompetitive-contracts.csv"),
              encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            vendor = (r.get("Supplier Name") or "").strip()
            doc = (r.get("Workspace Number") or "").strip()
            if quarantine_check(r.get("Contract Amount"), vendor, doc,
                                "tobids-non-competitive-contracts"):
                continue
            recs.append({
                "vendor_raw": vendor,
                "amount": parse_amount(r.get("Contract Amount")),
                "date": (r.get("Contract Date") or "").strip(),
                "kind": "non-competitive",
                "category": "Non-competitive",
                "type": "Non-competitive",
                "division": (r.get("Division") or "").strip(),
                "description": "",
                "doc": (r.get("Workspace Number") or "").strip(),
                "reason": fix_category(r.get("Reason")),
            })
    return recs


def load_consulting():
    """Consulting XLSX files: header row is row index 2 (0-based)."""
    import openpyxl
    files = ["consulting-2012-2016.xlsx", "consulting-2017-2021.xlsx",
             "consulting-2022-2023.xlsx", "consulting-2024.xlsx"]
    recs = []
    for f in files:
        p = os.path.join(RAW, f)
        if not os.path.exists(p):
            continue
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            if len(rows) < 4:
                continue
            hdr = [(str(c or "").replace("\n", " ").strip().upper())
                   for c in rows[2]]
            def col(*names):
                for n in names:
                    for i, h in enumerate(hdr):
                        if n in h:
                            return i
                return None
            ci_name = col("CONSULTANT'S NAME", "CONSULTANT")
            ci_amt = col("EXPENDITURE")
            ci_date = col("CONTRACT", "DATE")
            ci_cat = col("EXPENSE", "CATEGORY")
            ci_div = col("DIVISION")
            ci_desc = col("DESCRIPTION")
            ci_doc = col("PO NUMBER", "CONTRACT /")
            if ci_name is None or ci_amt is None:
                continue
            for r in rows[3:]:
                name = (str(r[ci_name]).strip() if r[ci_name] else "")
                if not name or name.upper() in ("TOTAL", "GRAND TOTAL"):
                    continue
                raw_amt = r[ci_amt]
                raw_str = str(raw_amt).strip() if raw_amt is not None else ""
                if quarantine_check(raw_str, name, "", "consulting-services"):
                    continue
                amt = parse_amount(raw_amt)
                if amt <= 0:
                    continue
                date = ""
                if ci_date is not None and r[ci_date]:
                    date = str(r[ci_date])[:10]
                recs.append({
                    "vendor_raw": name,
                    "amount": amt,
                    "date": date,
                    "kind": "consulting",
                    "category": fix_category(str(r[ci_cat]).strip())
                    if ci_cat is not None and r[ci_cat] else "Consulting",
                    "type": "Consulting expenditure",
                    "division": (str(r[ci_div]).strip()[:80]
                                 if ci_div is not None and r[ci_div]
                                 else ""),
                    "description": (str(r[ci_desc]).strip()[:300]
                                    if ci_desc is not None and r[ci_desc]
                                    else ""),
                    "doc": (str(r[ci_doc]).strip()
                            if ci_doc is not None and r[ci_doc] else ""),
                    "reason": "",
                })
    return recs


def load_gsin():
    rows = []
    with open(GSIN_CSV, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            rows.append(r)
    return rows


STOP = set("""for the and of to a an in on with by from or at as is are was were
be been will shall this that these those its their his her our your my
various other such including include includes within without between
per each any all both either neither not no nor so than too very can
may might must should could would do does did done having has have had
supply delivery provision provide provides provided services service
work works project projects contract contracts city toronto""".split())


def gsin_tokens(text):
    toks = re.sub(r"[^a-z0-9 ]", " ", (text or "").lower()).split()
    return {t for t in toks if len(t) > 2 and t not in STOP}


def build_gsin_hints(records, gsin_rows):
    """Heuristic keyword match of award descriptions to GSIN codes.
    Returns (hint_map, coverage): hint per record index -> (code, conf)."""
    gsin_tok = []
    for g in gsin_rows:
        toks = gsin_tokens(g.get("description_en", ""))
        if toks:
            gsin_tok.append((g["code"], g.get("description_en", ""),
                             g.get("commodity_type", ""), toks))
    hints = {}
    matched_high = 0
    for i, r in enumerate(records):
        dtoks = gsin_tokens(r["description"])
        if len(dtoks) < 3:
            continue
        best = None
        for code, desc, ctype, gtoks in gsin_tok:
            inter = dtoks & gtoks
            if not inter:
                continue
            score = len(inter) / max(len(dtoks), len(gtoks)) * 2 + \
                len(inter) * 0.1
            if best is None or score > best[0]:
                best = (score, code, desc, ctype, len(inter))
        if best and best[4] >= 3 and best[0] >= 0.55:
            conf = "high" if best[0] >= 0.9 else "low"
            hints[i] = {"gsin": best[1], "gsin_desc": best[2],
                        "commodity_type": best[3], "confidence": conf}
            if conf == "high":
                matched_high += 1
    return hints, matched_high


def main():
    awarded = load_awarded()
    noncomp = load_noncompetitive()
    consulting = load_consulting()
    records = awarded + noncomp + consulting
    records = [r for r in records if r["vendor_raw"] and r["amount"] > 0]
    for r in records:
        r["year"] = r["date"][:4] if re.match(r"\d{4}", r["date"]) else ""

    print(f"records: {len(records)} "
          f"(awarded {len(awarded)}, noncomp {len(noncomp)}, "
          f"consulting {len(consulting)})")

    # ---- entity resolution ----
    keys = {}
    for r in records:
        k = normalize_vendor(r["vendor_raw"])
        if not k:
            continue
        r["_key"] = k
        keys.setdefault(k, []).append(r)
    print(f"normalized keys: {len(keys)}")

    # fuzzy merge pass (union-find)
    key_list = sorted(keys)
    parent = {k: k for k in key_list}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    merges = []
    for i, a in enumerate(key_list):
        ta = a.split(" ")[0] if a else ""
        for b in key_list[i + 1:]:
            if not b.startswith(ta[:4]):
                continue
            if b.split(" ")[0] != ta:
                continue
            ratio = SequenceMatcher(None, a, b).ratio()
            if ratio >= 0.93:
                union(a, b)
                merges.append([a, b, round(ratio, 3)])

    clusters = defaultdict(list)
    for k in key_list:
        clusters[find(k)].append(k)
    print(f"clusters after fuzzy merge: {len(clusters)} "
          f"({len(merges)} pairwise merges)")

    # canonical vendor entities
    vendors = []
    for root, ks in clusters.items():
        recs = [r for k in ks for r in keys[k]]
        variants = Counter(r["vendor_raw"] for r in recs)
        canon = max(variants.items(),
                    key=lambda kv: (kv[1], len(kv[0])))[0]
        spend = sum(r["amount"] for r in recs)
        years = sorted({r["year"] for r in recs if r["year"]})
        cats = Counter(r["category"] for r in recs)
        kinds = Counter(r["kind"] for r in recs)
        vendors.append({
            "key": root,
            "canonical": canon,
            "variants": sorted(variants),
            "variant_count": len(variants),
            "awards": len(recs),
            "spend": round(spend, 2),
            "first_year": years[0] if years else "",
            "last_year": years[-1] if years else "",
            "categories": dict(cats.most_common(5)),
            "kinds": dict(kinds),
        })
    vendors.sort(key=lambda v: -v["spend"])
    for i, v in enumerate(vendors, 1):
        v["id"] = f"V{i:05d}"
    id_by_key = {}
    for v in vendors:
        for k in clusters[v["key"]]:
            id_by_key[k] = v["id"]

    for r in records:
        r["vendor_id"] = id_by_key.get(r.get("_key"), "")

    total_spend = sum(r["amount"] for r in records)
    print(f"canonical vendors: {len(vendors)}, "
          f"total spend ${total_spend/1e9:.2f}B")

    # ---- GSIN hints (heuristic, documented as suggestion-only) ----
    gsin_rows = load_gsin()
    hints, matched_high = build_gsin_hints(records, gsin_rows)
    for i, h in hints.items():
        records[i]["gsin_hint"] = h
    cov = len(hints) / max(len(records), 1) * 100
    print(f"GSIN hints: {len(hints)} records ({cov:.1f}%), "
          f"{matched_high} high confidence")

    # ---- aggregates ----
    by_year = defaultdict(lambda: {"competitive": 0.0, "non-competitive": 0.0,
                                   "consulting": 0.0, "awards": 0})
    for r in records:
        y = r["year"] or "unknown"
        by_year[y][r["kind"]] += r["amount"]
        by_year[y]["awards"] += 1
    by_year = [{"year": y, **{k: round(v, 2) for k, v in d.items()}}
               for y, d in sorted(by_year.items())]

    by_category = Counter()
    by_kind = Counter()
    by_kind_spend = Counter()
    by_division = Counter()
    by_division_spend = Counter()
    by_reason = Counter()
    by_reason_spend = Counter()
    by_rfx = Counter()
    by_rfx_spend = Counter()
    for r in records:
        by_category[r["category"]] += 1
        by_kind[r["kind"]] += 1
        by_kind_spend[r["kind"]] += r["amount"]
        if r["division"]:
            by_division[r["division"]] += 1
            by_division_spend[r["division"]] += r["amount"]
        if r["reason"]:
            by_reason[r["reason"]] += 1
            by_reason_spend[r["reason"]] += r["amount"]
        if r["type"] and r["kind"] == "competitive":
            by_rfx[r["type"]] += 1
            by_rfx_spend[r["type"]] += r["amount"]

    top_vendors = [{
        "id": v["id"], "name": v["canonical"], "spend": v["spend"],
        "awards": v["awards"], "variants": v["variant_count"],
        "first_year": v["first_year"], "last_year": v["last_year"],
        "share_pct": round(v["spend"] / total_spend * 100, 2),
    } for v in vendors[:25]]
    top10_share = round(sum(v["spend"] for v in vendors[:10])
                        / total_spend * 100, 1)

    repeat = Counter()
    for v in vendors:
        a = v["awards"]
        bucket = "1" if a == 1 else "2-5" if a <= 5 else "6-20" \
            if a <= 20 else "21+"
        repeat[bucket] += 1

    summary = {
        "meta": {
            "project": "toronto-procurement-spending",
            "sources": [
                {"name": "Toronto Bids Awarded Contracts",
                 "package": "tobids-awarded-contracts",
                 "records": len(awarded)},
                {"name": "Toronto Bids Non-Competitive Contracts",
                 "package": "tobids-non-competitive-contracts",
                 "records": len(noncomp)},
                {"name": "Consulting Services Expenditures",
                 "package": "consulting-services-expenditures",
                 "records": len(consulting)},
            ],
            "retrieved": RETRIEVED,
            "publisher": "City of Toronto Open Data (CKAN)",
            "total_records": len(records),
            "total_spend": round(total_spend, 2),
            "raw_vendor_names": len(keys),
            "canonical_vendors": len(vendors),
            "fuzzy_merges": len(merges),
            "gsin_hint_coverage_pct": round(cov, 1),
            "quarantined_records": QUARANTINED,
            "note": "Spend totals are award/expenditure values as published; "
                    "they are not audited payments. Quarantined records are "
                    "excluded from every total.",
        },
        "top10_share_pct": top10_share,
        "by_year": by_year,
        "by_kind": {
            k: {"awards": by_kind[k],
                "spend": round(by_kind_spend[k], 2),
                "share_pct": round(by_kind_spend[k] / total_spend * 100, 2)}
            for k in by_kind
        },
        "by_category": [
            {"category": c, "awards": n,
             "spend": round(sum(r["amount"] for r in records
                                if r["category"] == c), 2)}
            for c, n in by_category.most_common(12)
        ],
        "by_division": [
            {"division": d, "awards": by_division[d],
             "spend": round(by_division_spend[d], 2)}
            for d in sorted(by_division_spend,
                            key=lambda d: -by_division_spend[d])[:15]
        ],
        "noncomp_reasons": [
            {"reason": r_, "awards": by_reason[r_],
             "spend": round(by_reason_spend[r_], 2)}
            for r_ in sorted(by_reason_spend,
                             key=lambda r_: -by_reason_spend[r_])
        ],
        "rfx_types": [
            {"type": t_, "awards": by_rfx[t_],
             "spend": round(by_rfx_spend[t_], 2)}
            for t_ in sorted(by_rfx_spend, key=lambda t_: -by_rfx_spend[t_])
        ],
        "top_vendors": top_vendors,
        "repeat_winners": {k: repeat[k] for k in ["1", "2-5", "6-20", "21+"]},
        "limitations": [
            "Three award records carried bare 10-digit integers in the "
            "amount field (9054510208, 4163927134, 1898820680), the pattern "
            "of phone numbers rather than credible awards. They are "
            "quarantined in meta.quarantined_records and excluded from "
            "every total; without this, the headline spend would be "
            "overstated by $15.1B.",
            "Vendor identity is resolved heuristically from name strings; "
            "no business-number key exists in the source data. Merges are "
            "logged in vendor_merges.json for audit.",
            "Toronto publishes no commodity codes on award records. "
            "High Level Category is the source's own coarse coding; GSIN "
            "hints are keyword heuristics, suggestion-only.",
            "Amounts are award or expenditure values as published, not "
            "audited final payments; multi-year awards appear in full in "
            "the award year.",
            "The legacy wx.toronto.ca award postings (competitive-call-award-"
            "results, non-competitive-contracts) were unreachable at build "
            "time; the CKAN datastore dumps are the complete source used.",
            "Capital and procurement pipeline files describe planned work, "
            "not spending, and are excluded from all totals.",
        ],
    }

    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, "summary.json"), "w") as fh:
        json.dump(summary, fh, indent=1)

    vendors_index = [{
        "id": v["id"], "n": v["canonical"], "vc": v["variant_count"],
        "a": v["awards"], "s": v["spend"],
        "fy": v["first_year"], "ly": v["last_year"],
        "cats": v["categories"], "kinds": v["kinds"],
    } for v in vendors]
    with open(os.path.join(DATA, "vendors_index.json"), "w") as fh:
        json.dump(vendors_index, fh)

    awards_index = [{
        "v": r["vendor_id"], "a": round(r["amount"], 2), "y": r["year"],
        "k": r["kind"], "c": r["category"], "d": r["division"],
        "t": r["type"], "doc": r["doc"],
        "desc": r["description"][:200],
        **({"g": r["gsin_hint"]} if "gsin_hint" in r else {}),
    } for r in records]
    with open(os.path.join(DATA, "awards_index.json"), "w") as fh:
        json.dump(awards_index, fh)

    with open(os.path.join(DATA, "vendor_variants.csv"), "w",
              newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["raw_vendor_name", "vendor_id", "canonical_name",
                    "normalized_key"])
        for v in vendors:
            for var in v["variants"]:
                w.writerow([var, v["id"], v["canonical"], v["key"]])

    with open(os.path.join(DATA, "vendor_merges.json"), "w") as fh:
        json.dump({"merges": merges,
                   "method": "difflib ratio >= 0.93 and same first token, "
                             "union-find over normalized keys"},
                  fh, indent=1)

    pub = os.path.join(HERE, "public", "data")
    os.makedirs(pub, exist_ok=True)
    for f in ["summary.json", "vendor_variants.csv"]:
        with open(os.path.join(DATA, f), "rb") as src, \
                 open(os.path.join(pub, f), "wb") as dst:
            dst.write(src.read())

    print("wrote data/summary.json, vendors_index.json, awards_index.json, "
          "vendor_variants.csv, vendor_merges.json")
    print(f"TOP10 share: {top10_share}%")
    print("top 5 vendors:")
    for v in top_vendors[:5]:
        print(f"  {v['name'][:50]:52s} ${v['spend']/1e6:9.1f}M "
              f"({v['awards']} awards, {v['share_pct']}%)")


if __name__ == "__main__":
    main()
