import { NextResponse } from "next/server";
import { getData, searchVendors, lookupVendor } from "@/lib/procurement";

// Minimal MCP server over streamable HTTP (JSON-RPC 2.0 via POST).
// Supports: initialize, tools/list, tools/call. Stateless.

const SERVER = { name: "toronto-procurement-spending", version: "1.0.0" };

const TOOLS = [
  {
    name: "vendor_lookup",
    description:
      "Full record for one canonical Toronto procurement vendor: total spend, award count, name variants merged by entity resolution, years active, and top awards.",
    inputSchema: {
      type: "object",
      properties: {
        vendor_id: { type: "string", description: "Vendor id, e.g. V00001 from the search tool" },
      },
      required: ["vendor_id"],
    },
  },
  {
    name: "vendor_search",
    description:
      "Search 4,082 canonical vendors behind Toronto's $21.5B in procurement spend (2012-2026) by name, ranked by total spend.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Vendor name fragment" },
        limit: { type: "integer", description: "Max results, default 50, max 200" },
      },
    },
  },
  {
    name: "spend_summary",
    description:
      "Toronto procurement spend aggregates: total, top-10 vendor share, competitive vs non-competitive split, spend by year, category, division, non-competitive reasons, and RFx types.",
    inputSchema: { type: "object", properties: {} },
  },
];

function ok(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function err(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function textResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function handle(msg: any) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return err(msg?.id ?? null, -32600, "Invalid Request");
  }
  const id = msg.id ?? null;
  switch (msg.method) {
    case "initialize":
      return ok(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER,
      });
    case "notifications/initialized":
      return null;
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args } = msg.params ?? {};
      try {
        if (name === "vendor_lookup") {
          const hit = lookupVendor(String(args.vendor_id ?? ""));
          if (!hit) return err(id, -32001, `No vendor ${args.vendor_id}`);
          return ok(id, textResult(hit));
        }
        if (name === "vendor_search") {
          const q = String(args.q ?? "");
          const limit = Math.min(Math.max(parseInt(String(args.limit ?? "50"), 10) || 50, 1), 200);
          return ok(id, textResult({ q, limit, ...searchVendors(q, limit) }));
        }
        if (name === "spend_summary") {
          const { summary } = getData();
          return ok(id, textResult(summary));
        }
        return err(id, -32602, `Unknown tool ${name}`);
      } catch (e) {
        return err(id, -32000, `Tool error: ${(e as Error).message}`);
      }
    }
    default:
      return err(id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err(null, -32700, "Parse error"), { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = body.map(handle).filter((r) => r !== null);
    return NextResponse.json(out);
  }
  const out = handle(body);
  if (out === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(out);
}

export async function GET() {
  return NextResponse.json(
    { error: "This MCP server accepts JSON-RPC 2.0 via POST only." },
    { status: 405 }
  );
}

export async function DELETE() {
  return new NextResponse(null, { status: 405 });
}
