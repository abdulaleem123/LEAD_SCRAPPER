import type { IcpProfile, Lead, SearchTerms } from "./types";

const DEFAULT_TECH_TITLE_EXCLUDES = [
  "cto",
  "chief technology",
  "chief information",
  "cio",
  "vp engineering",
  "head of engineering",
  "head of it",
  "it director",
  "director of it",
  "software engineer",
  "devops",
  "sre",
  "engineering manager",
  "tech lead",
  "architect",
];

const DEFAULT_TECH_INDUSTRY_EXCLUDES = [
  "information technology",
  "software development",
  "computer software",
  "it services",
  "saas",
  "cybersecurity",
  "cloud computing",
  "devops",
  "artificial intelligence company",
  "machine learning",
];

const TECH_COMPANY_NAME_HINTS = [
  "software",
  "systems",
  "technologies",
  "tech ",
  " digital",
  "cyber",
  "cloud",
  "devops",
  "ai solutions",
  "data science",
];

function includesAny(haystack: string, needles: string[]) {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

export function evaluateLeadAgainstIcp(
  lead: Pick<
    Lead,
    "title" | "industry" | "companyName" | "companySize" | "fullName"
  >,
  profile?: IcpProfile | null,
  searchTerms?: SearchTerms | null,
): { ok: boolean; reason?: string } {
  const title = lead.title || "";
  const industry = lead.industry || "";
  const company = lead.companyName || "";

  const excludeTitles = [
    ...DEFAULT_TECH_TITLE_EXCLUDES,
    ...(profile?.excludeTitles || []),
    ...(searchTerms?.apollo.excludeTitles || []),
    ...(searchTerms?.linkedin.excludeKeywords || []),
  ];

  const excludeIndustries = [
    ...DEFAULT_TECH_INDUSTRY_EXCLUDES,
    ...(profile?.excludeIndustries || []),
  ];

  if (title && includesAny(title, excludeTitles)) {
    return { ok: false, reason: `Excluded title match: ${title}` };
  }

  if (industry && includesAny(industry, excludeIndustries)) {
    return { ok: false, reason: `Excluded industry: ${industry}` };
  }

  if (company && includesAny(company, TECH_COMPANY_NAME_HINTS)) {
    // Soft signal — only exclude if industry also looks technical or title empty
    if (!industry || includesAny(industry, ["software", "it ", "technology"])) {
      return {
        ok: false,
        reason: `Likely tech/IT company: ${company}`,
      };
    }
  }

  return { ok: true };
}

export function emptyProfile(): IcpProfile {
  return {
    summary: "",
    goldenGoose: "",
    companySize: "",
    dealSize: "",
    industries: [],
    titles: [],
    excludeTitles: [...DEFAULT_TECH_TITLE_EXCLUDES],
    excludeIndustries: [...DEFAULT_TECH_INDUSTRY_EXCLUDES],
    locations: [],
    painPoints: [],
    objections: [],
    triggers: [],
    easeOfContact: "",
    noBrainerOffer: "",
    pivots: [],
    coaching: "",
  };
}

export function emptySearchTerms(): SearchTerms {
  return {
    apollo: {
      employeeRange: "50-500",
      locations: [],
      titles: [],
      excludeTitles: [...DEFAULT_TECH_TITLE_EXCLUDES],
      industries: [],
      keywords: [],
    },
    linkedin: {
      keywords: "",
      titles: [],
      locations: [],
      companySize: "51-500",
      excludeKeywords: [...DEFAULT_TECH_TITLE_EXCLUDES],
    },
    apify: {
      searchQueries: [],
      profileMode: "Full",
      maxItems: 50,
      inputJson: {},
    },
    jobKeywords: ["data entry", "admin assistant", "operations coordinator"],
  };
}
