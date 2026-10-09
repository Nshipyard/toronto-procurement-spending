import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Toronto Procurement Spending API",
    version: "1.0.0",
    description:
      "Toronto's $21.5B in awarded contracts and consulting spend (2012-2026), resolved to 4,082 canonical vendors. Vendor search and lookup, spend aggregates by year, category, division, and competitive status. Three source records quarantined as phone-number typos and excluded from all totals. Source: City of Toronto Open Data (CKAN). MIT licensed.",
  },
  servers: [{ url: "https://procurement.canada.nshipyard.com/api/v1" }],
  paths: {
    "/vendor/search": {
      get: {
        summary: "Search canonical vendors by name, ranked by total spend",
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" }, example: "Furfari" },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 200 } },
        ],
        responses: { "200": { description: "Total plus matching vendor records with spend aggregates" } },
      },
    },
    "/vendor/lookup": {
      get: {
        summary: "Full record for one vendor: spend, awards, name variants, and top awards",
        parameters: [{ name: "vendor_id", in: "query", required: true, schema: { type: "string" }, example: "V00001" }],
        responses: { "200": { description: "Vendor record" }, "404": { description: "No vendor with that id" } },
      },
    },
    "/spend/summary": {
      get: {
        summary: "Spend aggregates: by year, kind, category, division, non-competitive reasons, RFx types, top vendors",
        responses: { "200": { description: "Full aggregate summary with methodology notes" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
