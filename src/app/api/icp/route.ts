import { NextResponse } from "next/server";
import { z } from "zod";
import { generateIcp, defaultProvider } from "@/lib/ai";
import { createIcp, listIcps } from "@/lib/db";
import { EXPERTS } from "@/lib/icp-experts";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    icps: listIcps(),
    experts: EXPERTS.map(({ id, name, tagline, description, questions }) => ({
      id,
      name,
      tagline,
      description,
      questions,
    })),
    defaultProvider: defaultProvider(),
  });
}

const BodySchema = z.object({
  expert: z.enum(["alex_berman", "patrick_dang", "eric_novoselov"]),
  provider: z.enum(["openai", "anthropic", "lmstudio"]).optional(),
  answers: z.record(z.string(), z.string()),
  name: z.string().optional(),
  offline: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const provider = body.provider || defaultProvider();
    const generated = await generateIcp({
      expert: body.expert,
      provider,
      answers: body.answers,
      offline: body.offline,
    });

    const saved = createIcp({
      name: body.name || generated.name,
      expert: body.expert,
      provider,
      answers: body.answers,
      profile: generated.profile,
      searchTerms: generated.searchTerms,
      score: generated.score,
    });

    return NextResponse.json({ icp: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ICP failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
