import { NextResponse } from "next/server";
import { leadsToCsv, listLeads } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const leads = listLeads({
    q: searchParams.get("q") || undefined,
    status: status === "all" || !status ? "all" : (status as "new"),
    source: (searchParams.get("source") as "all") || "all",
    hasEmail: searchParams.get("hasEmail") === "1",
    hasLinkedin: searchParams.get("hasLinkedin") === "1",
  }, 10000);

  const csv = leadsToCsv(leads);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
    },
  });
}
