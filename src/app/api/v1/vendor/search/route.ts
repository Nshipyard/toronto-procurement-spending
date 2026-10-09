import { NextResponse } from "next/server";
import { searchVendors } from "@/lib/procurement";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  return NextResponse.json({ q, limit, ...searchVendors(q, limit) });
}
