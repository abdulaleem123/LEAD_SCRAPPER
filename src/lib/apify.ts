import { ApifyClient } from "apify-client";
import type { Lead, ScrapeSource, SearchTerms } from "./types";
import { evaluateLeadAgainstIcp } from "./filters";
import type { IcpProfile } from "./types";

export function getApifyClient() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("Lead engine is not configured.");
  }
  return new ApifyClient({ token });
}

export function defaultActor(source: ScrapeSource, findEmails = false) {
  if (source === "google_maps") {
    return process.env.APIFY_MAPS_ACTOR || "compass/crawler-google-places";
  }
  if (findEmails) {
    return (
      process.env.APIFY_LINKEDIN_EMAIL_ACTOR ||
      process.env.APIFY_LINKEDIN_ACTOR ||
      "harvestapi/linkedin-profile-search"
    );
  }
  return (
    process.env.APIFY_LINKEDIN_ACTOR || "harvestapi/linkedin-profile-search"
  );
}

export function buildLinkedInInput(
  searchTerms: SearchTerms,
  maxItems: number,
  overrides?: Record<string, unknown>,
  options?: { findEmails?: boolean; searchQuery?: string },
) {
  const titles =
    searchTerms.linkedin.titles.length > 0
      ? searchTerms.linkedin.titles
      : ["CEO", "COO", "Founder", "Head of Operations"];

  const locations =
    searchTerms.linkedin.locations.length > 0
      ? searchTerms.linkedin.locations.map((loc) =>
          loc.replace(/^US$/i, "United States").replace(/^USA$/i, "United States"),
        )
      : ["United States"];

  const searchQuery =
    options?.searchQuery ||
    searchTerms.apify.searchQueries[0] ||
    searchTerms.linkedin.keywords ||
    titles.slice(0, 2).join(" ");

  const takePages = Math.max(1, Math.min(100, Math.ceil(maxItems / 25)));

  const base: Record<string, unknown> = {
    searchQuery,
    currentJobTitles: titles.slice(0, 5),
    locations,
    maxItems,
    takePages,
    profileScraperMode: options?.findEmails
      ? process.env.APIFY_EMAIL_PROFILE_MODE || "Full"
      : searchTerms.apify.profileMode || "Full",
  };

  if (options?.findEmails) {
    base.findEmail = true;
    base.includeEmail = true;
  }

  // Allow ICP overrides but strip wrong plural key from older ICPs.
  // Always keep request maxItems / takePages as the source of truth.
  const { searchQueries: _ignored, maxItems: _m, takePages: _t, ...restOverrides } =
    {
      ...(searchTerms.apify.inputJson || {}),
      ...(overrides || {}),
    };

  return { ...base, ...restOverrides, maxItems, takePages };
}

export function buildMapsInput(
  query: string,
  location: string,
  maxItems: number,
  overrides?: Record<string, unknown>,
) {
  return {
    searchStringsArray: [query],
    locationQuery: location,
    maxCrawledPlacesPerSearch: maxItems,
    language: "en",
    ...overrides,
  };
}

function pickString(...vals: unknown[]) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickEmail(item: Record<string, unknown>): string | null {
  const direct = pickString(
    item.email,
    item.workEmail,
    item.primaryEmail,
    item.businessEmail,
    item.personalEmail,
  );
  if (direct && direct.includes("@")) return direct;

  const emails = item.emails;
  if (Array.isArray(emails)) {
    for (const entry of emails) {
      if (typeof entry === "string" && entry.includes("@")) return entry.trim();
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const found = pickString(e.email, e.value, e.address);
        if (found && found.includes("@")) return found;
      }
    }
  }

  const contact = item.contactInfo as Record<string, unknown> | undefined;
  if (contact) {
    const found = pickString(contact.email, contact.workEmail, contact.primaryEmail);
    if (found && found.includes("@")) return found;
  }

  const company =
    (item.company as Record<string, unknown> | undefined) ||
    (item.currentCompany as Record<string, unknown> | undefined);
  if (company) {
    const found = pickString(company.email, company.companyEmail);
    if (found && found.includes("@")) return found;
  }

  return null;
}

export function linkedinSearchQueries(searchTerms: SearchTerms): string[] {
  const titles =
    searchTerms.linkedin.titles.length > 0
      ? searchTerms.linkedin.titles
      : ["CEO", "COO", "Founder"];
  const queries = searchTerms.apify.searchQueries.filter(Boolean);
  if (queries.length > 0) return queries;
  const kw = searchTerms.linkedin.keywords?.trim();
  if (kw) return [kw];
  return [`${titles[0]} ${titles[1] || ""}`.trim()];
}

function splitName(full: string | null) {
  if (!full) return { firstName: null, lastName: null };
  const parts = full.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

export function normalizeApifyItem(
  item: Record<string, unknown>,
  source: ScrapeSource,
): Omit<
  Lead,
  "id" | "createdAt" | "updatedAt" | "icpId" | "scrapeRunId" | "status" | "excludeReason"
> {
  if (source === "google_maps") {
    const companyName = pickString(item.title, item.name, item.placeName);
    return {
      source,
      fullName: null,
      firstName: null,
      lastName: null,
      title: null,
      email: pickString(item.email, item.emails?.[0 as never]),
      phone: pickString(item.phone, item.phoneUnformatted, item.telephone),
      linkedinUrl: null,
      companyName,
      companyWebsite: pickString(item.website, item.url, item.websiteUrl),
      companyLinkedin: null,
      companySize: null,
      industry: pickString(item.categoryName, item.category),
      location: pickString(item.address, item.city, item.location),
      address: pickString(item.address),
      rawJson: JSON.stringify(item),
    };
  }

  const fullName = pickString(
    item.fullName,
    item.name,
    [item.firstName, item.lastName].filter(Boolean).join(" "),
  );
  const { firstName, lastName } = splitName(fullName);
  const company =
    (item.company as Record<string, unknown> | undefined) ||
    (item.currentCompany as Record<string, unknown> | undefined) ||
    {};

  return {
    source,
    fullName,
    firstName: pickString(item.firstName) || firstName,
    lastName: pickString(item.lastName) || lastName,
    title: pickString(
      item.title,
      item.headline,
      item.occupation,
      item.jobTitle,
    ),
    email: pickEmail(item),
    phone: pickString(item.phone, item.mobilePhone, item.phoneNumber),
    linkedinUrl: pickString(
      item.linkedinUrl,
      item.profileUrl,
      item.url,
      item.linkedinProfileUrl,
    ),
    companyName: pickString(
      item.companyName,
      company.name,
      item.organizationName,
    ),
    companyWebsite: pickString(
      item.companyWebsite,
      company.website,
      company.websiteUrl,
    ),
    companyLinkedin: pickString(
      item.companyLinkedinUrl,
      company.linkedinUrl,
      company.url,
    ),
    companySize: pickString(
      item.companySize,
      company.staffCountRange,
      company.size,
      item.employeeCount,
    ),
    industry: pickString(item.industry, company.industry, item.companyIndustry),
    location: pickString(
      item.location,
      item.geoLocation,
      item.city,
      [item.city, item.country].filter(Boolean).join(", "),
    ),
    address: pickString(item.address),
    rawJson: JSON.stringify(item),
  };
}

export async function runActorAndCollect(options: {
  actorId: string;
  input: Record<string, unknown>;
  maxItems: number;
  waitSecs?: number;
}) {
  const client = getApifyClient();
  const run = await client.actor(options.actorId).call(options.input, {
    waitSecs: options.waitSecs ?? 600,
  });

  if (!run?.defaultDatasetId) {
    throw new Error("Lead engine run finished without results");
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: Math.min(options.maxItems, 2500),
  });

  return {
    apifyRunId: run.id as string,
    items: items as Record<string, unknown>[],
  };
}

export async function collectLinkedInLeads(options: {
  searchTerms: SearchTerms;
  maxItems: number;
  findEmails: boolean;
  actorId?: string;
  overrides?: Record<string, unknown>;
}) {
  const actorId = options.actorId || defaultActor("linkedin", options.findEmails);
  const queries = linkedinSearchQueries(options.searchTerms);
  const collected: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let lastRunId: string | null = null;

  for (const query of queries) {
    if (collected.length >= options.maxItems) break;

    const remaining = options.maxItems - collected.length;
    const input = buildLinkedInInput(
      options.searchTerms,
      remaining,
      options.overrides,
      { findEmails: options.findEmails, searchQuery: query },
    );

    const { apifyRunId, items } = await runActorAndCollect({
      actorId,
      input,
      maxItems: remaining,
      waitSecs: remaining > 500 ? 900 : 600,
    });

    lastRunId = apifyRunId;
    for (const item of items) {
      const key =
        pickString(item.linkedinUrl, item.profileUrl, item.url, item.email) ||
        JSON.stringify(item).slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(item);
      if (collected.length >= options.maxItems) break;
    }
  }

  return { apifyRunId: lastRunId, items: collected };
}

export function applyIcpFilter(
  normalized: ReturnType<typeof normalizeApifyItem>,
  profile?: IcpProfile | null,
  searchTerms?: SearchTerms | null,
) {
  const verdict = evaluateLeadAgainstIcp(normalized, profile, searchTerms);
  return {
    ...normalized,
    status: verdict.ok ? ("new" as const) : ("excluded" as const),
    excludeReason: verdict.reason ?? null,
  };
}
