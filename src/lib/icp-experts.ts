import type { ExpertId } from "./types";

export interface ExpertQuestion {
  id: string;
  label: string;
  placeholder?: string;
  options?: string[];
}

export interface ExpertFramework {
  id: ExpertId;
  name: string;
  tagline: string;
  description: string;
  systemPrompt: string;
  questions: ExpertQuestion[];
}

export const EXPERTS: ExpertFramework[] = [
  {
    id: "alex_berman",
    name: "Alex Berman",
    tagline: "Golden Goose ICP",
    description:
      "Sizes the market for cold LinkedIn/email: big enough to pay, small enough to move, structurally unable to build it themselves.",
    systemPrompt: `You are an elite cold outreach strategist channeling Alex Berman's ICP methodology ("Golden Goose").

Your job is to diagnose the user's offer and produce a sharp Ideal Client Profile for cold outreach (LinkedIn + email).

Rules:
- Prefer mid-market buyers who can afford the offer and move fast.
- Avoid "broke boys" (too small / can't pay) and heavy enterprise with deep gatekeepers unless justified.
- If the offer is automation/AI services, EXCLUDE technical buyers (CTO, Head of IT, engineering leads) who may rebuild in-house.
- Favor founder/CEO/COO/ops/revenue leaders with clear admin/data/process pain.
- Produce concrete titles, industries, locations, exclude lists, job-posting triggers, objections, and a no-brainer offer angle.
- Score the ICP quality 0-100 (green light >= 80).
- Be direct, practical, and sales-usable — no fluff.`,
    questions: [
      {
        id: "offer",
        label: "What is the main offer you want to sell?",
        placeholder: "e.g. Bespoke automation / AI systems for ops teams",
      },
      {
        id: "companySize",
        label: "Ideal company size?",
        options: [
          "SMB (1-49)",
          "Mid-market (50-500)",
          "Mid-high (200-2000)",
          "Enterprise (2000+)",
        ],
      },
      {
        id: "techTeam",
        label: "Should targets have an in-house tech/IT team?",
        options: [
          "No tech/IT team (preferred)",
          "Small tech team OK",
          "Doesn't matter",
        ],
      },
      {
        id: "channels",
        label: "Primary acquisition channels?",
        options: [
          "Cold LinkedIn",
          "Cold email",
          "Cold LinkedIn + email",
          "Warm referrals + cold",
        ],
      },
      {
        id: "objections",
        label: "Top objections you hear?",
        placeholder: "price too high, takes too long, won't work here, stalling",
      },
      {
        id: "locations",
        label: "Target locations / markets?",
        placeholder: "e. of South Africa, US, UK, DACH",
      },
      {
        id: "industries",
        label: "Preferred industries (or past wins)?",
        placeholder: "logistics, legal, higher ed, BPO, professional services",
      },
      {
        id: "dealSize",
        label: "Typical deal size / budget range?",
        placeholder: "e.g. $5k–$50k projects",
      },
    ],
  },
  {
    id: "patrick_dang",
    name: "Patrick Dang",
    tagline: "Pain → Persona → Pitch",
    description:
      "Starts from painful workflows and reverse-engineers the buyer persona who feels that pain daily.",
    systemPrompt: `You are a cold outreach expert using Patrick Dang's Pain → Persona → Pitch framework.

Build an ICP by:
1) Naming the expensive/painful operational problem.
2) Identifying who owns that pain (title + context).
3) Defining when they are in-market (triggers).
4) Crafting a pitch that speaks to outcomes, not features.

Exclude lookalike competitors (people who already sell the same thing). Output concrete search filters for Apollo/LinkedIn/Apify.`,
    questions: [
      {
        id: "offer",
        label: "What do you sell, in one sentence?",
      },
      {
        id: "pain",
        label: "What painful process do you remove?",
        placeholder: "manual data entry, reporting, lead follow-up, onboarding",
      },
      {
        id: "whoFeelsIt",
        label: "Who feels that pain every week?",
        placeholder: "Founder, Ops Manager, Head of CX, etc.",
      },
      {
        id: "costOfInaction",
        label: "What does inaction cost them?",
        placeholder: "wasted payroll, lost deals, slow delivery",
      },
      {
        id: "proof",
        label: "Best proof / case study you have?",
      },
      {
        id: "locations",
        label: "Geography?",
      },
      {
        id: "companySize",
        label: "Company size sweet spot?",
      },
      {
        id: "channels",
        label: "Outreach channel?",
        options: ["LinkedIn", "Email", "Both"],
      },
    ],
  },
  {
    id: "eric_novoselov",
    name: "Eric Novoselov",
    tagline: "Signal-based targeting",
    description:
      "Builds lists from buying signals: hiring, tools, growth, and public intent — then filters hard.",
    systemPrompt: `You are a signal-based prospecting strategist inspired by Eric Novoselov's approach.

Create an ICP centered on observable buying signals:
- Hiring for admin/data roles
- Tool stack gaps
- Growth / funding / expansion
- Process-heavy industries

Produce tight include/exclude lists and Apify/LinkedIn search queries that encode those signals. Prefer precision over volume.`,
    questions: [
      {
        id: "offer",
        label: "Offer / product?",
      },
      {
        id: "signals",
        label: "Which buying signals matter most?",
        placeholder: "hiring data entry, posting admin roles, no CRM, expansion",
      },
      {
        id: "titles",
        label: "Must-include titles?",
      },
      {
        id: "excludeTitles",
        label: "Must-exclude titles?",
        placeholder: "CTO, IT Director, Head of Engineering",
      },
      {
        id: "industries",
        label: "Industries?",
      },
      {
        id: "locations",
        label: "Locations?",
      },
      {
        id: "companySize",
        label: "Headcount range?",
      },
      {
        id: "channels",
        label: "Channel?",
        options: ["LinkedIn", "Email", "Both"],
      },
    ],
  },
];

export function getExpert(id: ExpertId) {
  return EXPERTS.find((e) => e.id === id) ?? EXPERTS[0];
}
