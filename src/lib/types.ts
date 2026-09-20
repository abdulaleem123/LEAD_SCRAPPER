export type ExpertId = "alex_berman" | "patrick_dang" | "eric_novoselov";

export type AiProvider = "openai" | "anthropic" | "lmstudio";

export type LeadStatus =
  | "new"
  | "qualified"
  | "excluded"
  | "contacted"
  | "replied"
  | "archived";

export type ScrapeSource = "linkedin" | "google_maps" | "apollo_export" | "manual" | "web";

export interface IcpRecord {
  id: string;
  name: string;
  expert: ExpertId;
  provider: AiProvider;
  answers: Record<string, string>;
  profile: IcpProfile;
  searchTerms: SearchTerms;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IcpProfile {
  summary: string;
  goldenGoose: string;
  companySize: string;
  dealSize: string;
  industries: string[];
  titles: string[];
  excludeTitles: string[];
  excludeIndustries: string[];
  locations: string[];
  painPoints: string[];
  objections: string[];
  triggers: string[];
  easeOfContact: string;
  noBrainerOffer: string;
  pivots: string[];
  coaching: string;
}

export interface SearchTerms {
  apollo: {
    employeeRange: string;
    locations: string[];
    titles: string[];
    excludeTitles: string[];
    industries: string[];
    keywords: string[];
  };
  linkedin: {
    keywords: string;
    titles: string[];
    locations: string[];
    companySize: string;
    excludeKeywords: string[];
  };
  apify: {
    searchQueries: string[];
    profileMode: string;
    maxItems: number;
    inputJson: Record<string, unknown>;
  };
  jobKeywords: string[];
}

export interface Lead {
  id: string;
  icpId: string | null;
  scrapeRunId: string | null;
  source: ScrapeSource;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyLinkedin: string | null;
  companySize: string | null;
  industry: string | null;
  location: string | null;
  address: string | null;
  status: LeadStatus;
  excludeReason: string | null;
  rawJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapeRun {
  id: string;
  icpId: string | null;
  source: ScrapeSource;
  actorId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  requested: number;
  imported: number;
  excluded: number;
  apifyRunId: string | null;
  error: string | null;
  inputJson: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface LeadFilters {
  q?: string;
  status?: LeadStatus | "all";
  source?: ScrapeSource | "all";
  icpId?: string | "all";
  hasEmail?: boolean;
  hasLinkedin?: boolean;
}
