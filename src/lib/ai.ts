import OpenAI from "openai";
import { z } from "zod";
import { getExpert } from "./icp-experts";
import { emptyProfile, emptySearchTerms } from "./filters";
import type { AiProvider, ExpertId, IcpProfile, SearchTerms } from "./types";

const IcpSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  profile: z.object({
    summary: z.string(),
    goldenGoose: z.string(),
    companySize: z.string(),
    dealSize: z.string(),
    industries: z.array(z.string()),
    titles: z.array(z.string()),
    excludeTitles: z.array(z.string()),
    excludeIndustries: z.array(z.string()),
    locations: z.array(z.string()),
    painPoints: z.array(z.string()),
    objections: z.array(z.string()),
    triggers: z.array(z.string()),
    easeOfContact: z.string(),
    noBrainerOffer: z.string(),
    pivots: z.array(z.string()),
    coaching: z.string(),
  }),
  searchTerms: z.object({
    apollo: z.object({
      employeeRange: z.string(),
      locations: z.array(z.string()),
      titles: z.array(z.string()),
      excludeTitles: z.array(z.string()),
      industries: z.array(z.string()),
      keywords: z.array(z.string()),
    }),
    linkedin: z.object({
      keywords: z.string(),
      titles: z.array(z.string()),
      locations: z.array(z.string()),
      companySize: z.string(),
      excludeKeywords: z.array(z.string()),
    }),
    apify: z.object({
      searchQueries: z.array(z.string()),
      profileMode: z.string(),
      maxItems: z.number(),
      inputJson: z.record(z.string(), z.unknown()),
    }),
    jobKeywords: z.array(z.string()),
  }),
});

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function completeWithProvider(
  provider: AiProvider,
  system: string,
  user: string,
): Promise<string> {
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is missing");
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.4,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || "Anthropic request failed");
    }
    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    return text;
  }

  const isLocal = provider === "lmstudio";
  if (!isLocal && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const client = new OpenAI({
    apiKey: isLocal
      ? process.env.LM_STUDIO_API_KEY || "lm-studio"
      : process.env.OPENAI_API_KEY,
    baseURL: isLocal
      ? process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1"
      : undefined,
  });

  const model = isLocal
    ? process.env.LM_STUDIO_MODEL || "local-model"
    : process.env.OPENAI_MODEL || "gpt-4o";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  return completion.choices[0]?.message?.content || "";
}

function buildTemplateIcp(answers: Record<string, string>): {
  name: string;
  score: number;
  profile: IcpProfile;
  searchTerms: SearchTerms;
} {
  const offer = answers.offer || "your offer";
  const size = answers.companySize || "Mid-market (50-500)";
  const locations = (answers.locations || "United States")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const industries = (answers.industries || "professional services")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const titles = (
    answers.titles ||
    answers.whoFeelsIt ||
    "Founder, CEO, COO, Head of Operations"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const profile = emptyProfile();
  profile.summary = `Targets ${size} buyers for ${offer}. Focus on operators who feel process pain, not technical rebuilders.`;
  profile.goldenGoose = `${size}; can pay ${answers.dealSize || "project fees"}; prefers teams without deep IT so adoption is faster.`;
  profile.companySize = size;
  profile.dealSize = answers.dealSize || "Custom";
  profile.industries = industries;
  profile.titles = titles;
  profile.locations = locations;
  profile.painPoints = [answers.pain || answers.offer || "manual ops work"].filter(
    Boolean,
  );
  profile.objections = (answers.objections || "price, timing, stall")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  profile.triggers = [
    "Hiring data entry / admin roles",
    "Ops bottlenecks",
    "No in-house automation team",
  ];
  profile.easeOfContact =
    "Founder/ops leaders — fewer IT gatekeepers when tech team is thin.";
  profile.noBrainerOffer = `Outcome-led ${offer} pitched against concrete admin/payroll waste.`;
  profile.coaching =
    "Template ICP (no AI key). Add OPENAI_API_KEY / ANTHROPIC_API_KEY for expert-quality scoring.";
  profile.pivots = ["Tighten industry", "Raise deal size floor", "Add job-post signals"];

  const searchTerms = emptySearchTerms();
  searchTerms.apollo.employeeRange = "50-500";
  searchTerms.apollo.locations = locations;
  searchTerms.apollo.titles = titles;
  searchTerms.apollo.industries = industries;
  searchTerms.apollo.keywords = [offer];
  searchTerms.linkedin.titles = titles;
  searchTerms.linkedin.locations = locations;
  searchTerms.linkedin.keywords = `${titles[0] || "Founder"} ${industries[0] || ""}`.trim();
  searchTerms.apify.searchQueries = [
    `${titles[0] || "Founder"} ${locations[0] || ""} ${industries[0] || ""}`.trim(),
    `${offer} ${locations[0] || ""}`.trim(),
  ];
  searchTerms.apify.inputJson = {
    searchQuery: searchTerms.apify.searchQueries[0],
    currentJobTitles: titles.slice(0, 5),
    locations,
    takePages: 2,
    profileScraperMode: "Full",
  };

  return {
    name: `${industries[0] || "Core"} - ${size}`.slice(0, 60),
    score: 72,
    profile,
    searchTerms,
  };
}

export async function generateIcp(input: {
  expert: ExpertId;
  provider: AiProvider;
  answers: Record<string, string>;
  offline?: boolean;
}): Promise<{
  name: string;
  score: number;
  profile: IcpProfile;
  searchTerms: SearchTerms;
}> {
  if (input.offline || input.provider === "lmstudio" && process.env.FORCE_TEMPLATE === "1") {
    return buildTemplateIcp(input.answers);
  }

  // Graceful fallback when no AI credentials are configured
  const missingOpenAI =
    input.provider === "openai" && !process.env.OPENAI_API_KEY;
  const missingAnthropic =
    input.provider === "anthropic" && !process.env.ANTHROPIC_API_KEY;
  if (missingOpenAI || missingAnthropic) {
    return buildTemplateIcp(input.answers);
  }

  const expert = getExpert(input.expert);

  const answerBlock = Object.entries(input.answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const userPrompt = `Using the ${expert.name} framework, generate a complete Ideal Client Profile and searchable lead filters.

Answers from the founder:
${answerBlock}

Return ONLY valid JSON matching this shape:
{
  "name": "short ICP campaign name",
  "score": 0-100,
  "profile": {
    "summary": "",
    "goldenGoose": "",
    "companySize": "",
    "dealSize": "",
    "industries": [],
    "titles": [],
    "excludeTitles": [],
    "excludeIndustries": [],
    "locations": [],
    "painPoints": [],
    "objections": [],
    "triggers": [],
    "easeOfContact": "",
    "noBrainerOffer": "",
    "pivots": [],
    "coaching": ""
  },
  "searchTerms": {
    "apollo": {
      "employeeRange": "50-500",
      "locations": [],
      "titles": [],
      "excludeTitles": [],
      "industries": [],
      "keywords": []
    },
    "linkedin": {
      "keywords": "",
      "titles": [],
      "locations": [],
      "companySize": "51-500",
      "excludeKeywords": []
    },
    "apify": {
      "searchQueries": ["query1", "query2"],
      "profileMode": "Full",
      "maxItems": 50,
      "inputJson": {
        "searchQuery": "Head of Operations",
        "currentJobTitles": ["CEO", "COO", "Head of Operations"],
        "locations": ["United States"],
        "takePages": 2,
        "profileScraperMode": "Full",
        "maxItems": 50
      }
    },
    "jobKeywords": []
  }
}

Important:
- Always include strong IT/tech title + industry excludes when selling automation to non-tech buyers.
- Apify inputJson must match harvestapi/linkedin-profile-search: searchQuery (string), currentJobTitles (array), locations (array, use "United States"), takePages, maxItems, profileScraperMode.
- Prefer precision. Include jobKeywords that signal manual admin work.`;

  const content = await completeWithProvider(
    input.provider,
    expert.systemPrompt,
    userPrompt,
  );
  const parsed = IcpSchema.parse(extractJson(content));

  const profile = { ...emptyProfile(), ...parsed.profile };
  const searchTerms = {
    ...emptySearchTerms(),
    ...parsed.searchTerms,
    apollo: { ...emptySearchTerms().apollo, ...parsed.searchTerms.apollo },
    linkedin: {
      ...emptySearchTerms().linkedin,
      ...parsed.searchTerms.linkedin,
    },
    apify: { ...emptySearchTerms().apify, ...parsed.searchTerms.apify },
  };

  return {
    name: parsed.name,
    score: parsed.score,
    profile,
    searchTerms,
  };
}

export function defaultProvider(): AiProvider {
  const p = (process.env.AI_PROVIDER || "openai").toLowerCase();
  if (p === "anthropic" || p === "lmstudio" || p === "openai") return p;
  return "openai";
}
