import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createScrapeRun,
  getIcp,
  listScrapeRuns,
  updateScrapeRun,
  upsertLead,
} from "@/lib/db";
import {
  applyIcpFilter,
  buildLinkedInInput,
  buildMapsInput,
  collectLinkedInLeads,
  defaultActor,
  normalizeApifyItem,
  runActorAndCollect,
} from "@/lib/apify";
import { emptySearchTerms } from "@/lib/filters";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ runs: listScrapeRuns(30) });
}

const BodySchema = z.object({
  icpId: z.string().nullable().optional(),
  source: z.enum(["linkedin", "google_maps"]).default("linkedin"),
  maxItems: z.number().int().min(1).max(2500).default(50),
  mapsQuery: z.string().optional(),
  mapsLocation: z.string().optional(),
  findEmails: z.boolean().default(false),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const icp = body.icpId ? getIcp(body.icpId) : null;
    const searchTerms = icp?.searchTerms || emptySearchTerms();
    const actorId = defaultActor(body.source, body.findEmails);

    const input =
      body.source === "google_maps"
        ? buildMapsInput(
            body.mapsQuery || searchTerms.apify.searchQueries[0] || "businesses",
            body.mapsLocation ||
              searchTerms.linkedin.locations[0] ||
              "United States",
            body.maxItems,
          )
        : buildLinkedInInput(searchTerms, body.maxItems, undefined, {
            findEmails: body.findEmails,
          });

    const run = createScrapeRun({
      icpId: icp?.id ?? null,
      source: body.source,
      actorId: "lead-engine",
      requested: body.maxItems,
      inputJson: { ...input, findEmails: body.findEmails },
    });

    if (body.dryRun) {
      updateScrapeRun(run.id, {
        status: "succeeded",
        finishedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        run: updateScrapeRun(run.id, {}),
        dryRun: true,
        input,
      });
    }

    updateScrapeRun(run.id, { status: "running" });

    try {
      let apifyRunId: string | null = null;
      let items: Record<string, unknown>[] = [];

      if (body.source === "linkedin") {
        const result = await collectLinkedInLeads({
          searchTerms,
          maxItems: body.maxItems,
          findEmails: body.findEmails,
          actorId,
        });
        apifyRunId = result.apifyRunId;
        items = result.items;
      } else {
        const result = await runActorAndCollect({
          actorId,
          input,
          maxItems: body.maxItems,
        });
        apifyRunId = result.apifyRunId;
        items = result.items;
      }

      let imported = 0;
      let excluded = 0;
      let withEmail = 0;

      for (const item of items) {
        const normalized = normalizeApifyItem(item, body.source);
        if (normalized.email) withEmail += 1;
        const filtered = applyIcpFilter(
          normalized,
          icp?.profile,
          icp?.searchTerms,
        );
        const { inserted } = upsertLead({
          ...filtered,
          icpId: icp?.id ?? null,
          scrapeRunId: run.id,
        });
        if (filtered.status === "excluded") excluded += 1;
        else if (inserted) imported += 1;
      }

      const finished = updateScrapeRun(run.id, {
        status: "succeeded",
        apifyRunId,
        imported,
        excluded,
        finishedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        run: finished,
        imported,
        excluded,
        withEmail,
        totalFetched: items.length,
      });
    } catch (inner) {
      const message = inner instanceof Error ? inner.message : "Scrape failed";
      updateScrapeRun(run.id, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
      });
      return NextResponse.json({ error: message, runId: run.id }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
