import { NextResponse } from "next/server";
import { getStats, listIcps, listScrapeRuns, listLeads } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    stats: getStats(),
    recentLeads: listLeads({ status: "new" }, 8),
    icps: listIcps().slice(0, 5),
    runs: listScrapeRuns(5),
    config: {
      leadEngineReady: Boolean(process.env.APIFY_TOKEN),
      aiReady: Boolean(
        process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
      ),
      provider: process.env.AI_PROVIDER || "openai",
    },
  });
}
