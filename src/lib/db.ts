import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  AiProvider,
  ExpertId,
  IcpProfile,
  IcpRecord,
  Lead,
  LeadFilters,
  LeadStatus,
  ScrapeRun,
  ScrapeSource,
  SearchTerms,
} from "./types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "sales-os.db");

let db: Database.Database | null = null;

function getDb() {
  if (db) return db;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS icps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      expert TEXT NOT NULL,
      provider TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      search_terms_json TEXT NOT NULL,
      score INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id TEXT PRIMARY KEY,
      icp_id TEXT,
      source TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      status TEXT NOT NULL,
      requested INTEGER NOT NULL DEFAULT 0,
      imported INTEGER NOT NULL DEFAULT 0,
      excluded INTEGER NOT NULL DEFAULT 0,
      apify_run_id TEXT,
      error TEXT,
      input_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      icp_id TEXT,
      scrape_run_id TEXT,
      source TEXT NOT NULL,
      full_name TEXT,
      first_name TEXT,
      last_name TEXT,
      title TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      company_name TEXT,
      company_website TEXT,
      company_linkedin TEXT,
      company_size TEXT,
      industry TEXT,
      location TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      exclude_reason TEXT,
      raw_json TEXT,
      dedupe_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_name);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
  `);
}

function now() {
  return new Date().toISOString();
}

function mapIcp(row: Record<string, unknown>): IcpRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    expert: row.expert as ExpertId,
    provider: row.provider as AiProvider,
    answers: JSON.parse(String(row.answers_json)),
    profile: JSON.parse(String(row.profile_json)),
    searchTerms: JSON.parse(String(row.search_terms_json)),
    score: row.score == null ? null : Number(row.score),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    icpId: row.icp_id == null ? null : String(row.icp_id),
    scrapeRunId: row.scrape_run_id == null ? null : String(row.scrape_run_id),
    source: row.source as ScrapeSource,
    fullName: row.full_name == null ? null : String(row.full_name),
    firstName: row.first_name == null ? null : String(row.first_name),
    lastName: row.last_name == null ? null : String(row.last_name),
    title: row.title == null ? null : String(row.title),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    linkedinUrl: row.linkedin_url == null ? null : String(row.linkedin_url),
    companyName: row.company_name == null ? null : String(row.company_name),
    companyWebsite:
      row.company_website == null ? null : String(row.company_website),
    companyLinkedin:
      row.company_linkedin == null ? null : String(row.company_linkedin),
    companySize: row.company_size == null ? null : String(row.company_size),
    industry: row.industry == null ? null : String(row.industry),
    location: row.location == null ? null : String(row.location),
    address: row.address == null ? null : String(row.address),
    status: row.status as LeadStatus,
    excludeReason:
      row.exclude_reason == null ? null : String(row.exclude_reason),
    rawJson: row.raw_json == null ? null : String(row.raw_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRun(row: Record<string, unknown>): ScrapeRun {
  return {
    id: String(row.id),
    icpId: row.icp_id == null ? null : String(row.icp_id),
    source: row.source as ScrapeSource,
    actorId: String(row.actor_id),
    status: row.status as ScrapeRun["status"],
    requested: Number(row.requested),
    imported: Number(row.imported),
    excluded: Number(row.excluded),
    apifyRunId: row.apify_run_id == null ? null : String(row.apify_run_id),
    error: row.error == null ? null : String(row.error),
    inputJson: String(row.input_json),
    createdAt: String(row.created_at),
    finishedAt: row.finished_at == null ? null : String(row.finished_at),
  };
}

export function createIcp(input: {
  name: string;
  expert: ExpertId;
  provider: AiProvider;
  answers: Record<string, string>;
  profile: IcpProfile;
  searchTerms: SearchTerms;
  score: number | null;
}): IcpRecord {
  const database = getDb();
  const id = randomUUID();
  const ts = now();
  database
    .prepare(
      `INSERT INTO icps
      (id, name, expert, provider, answers_json, profile_json, search_terms_json, score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.expert,
      input.provider,
      JSON.stringify(input.answers),
      JSON.stringify(input.profile),
      JSON.stringify(input.searchTerms),
      input.score,
      ts,
      ts,
    );
  return getIcp(id)!;
}

export function listIcps(): IcpRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM icps ORDER BY created_at DESC`)
    .all() as Record<string, unknown>[];
  return rows.map(mapIcp);
}

export function getIcp(id: string): IcpRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM icps WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapIcp(row) : null;
}

export function deleteIcp(id: string) {
  getDb().prepare(`DELETE FROM icps WHERE id = ?`).run(id);
}

export function createScrapeRun(input: {
  icpId: string | null;
  source: ScrapeSource;
  actorId: string;
  requested: number;
  inputJson: Record<string, unknown>;
}): ScrapeRun {
  const id = randomUUID();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO scrape_runs
      (id, icp_id, source, actor_id, status, requested, imported, excluded, input_json, created_at)
      VALUES (?, ?, ?, ?, 'queued', ?, 0, 0, ?, ?)`,
    )
    .run(
      id,
      input.icpId,
      input.source,
      input.actorId,
      input.requested,
      JSON.stringify(input.inputJson),
      ts,
    );
  return getScrapeRun(id)!;
}

export function updateScrapeRun(
  id: string,
  patch: Partial<{
    status: ScrapeRun["status"];
    imported: number;
    excluded: number;
    apifyRunId: string | null;
    error: string | null;
    finishedAt: string | null;
  }>,
) {
  const current = getScrapeRun(id);
  if (!current) return null;
  getDb()
    .prepare(
      `UPDATE scrape_runs SET
        status = ?,
        imported = ?,
        excluded = ?,
        apify_run_id = ?,
        error = ?,
        finished_at = ?
      WHERE id = ?`,
    )
    .run(
      patch.status ?? current.status,
      patch.imported ?? current.imported,
      patch.excluded ?? current.excluded,
      patch.apifyRunId === undefined ? current.apifyRunId : patch.apifyRunId,
      patch.error === undefined ? current.error : patch.error,
      patch.finishedAt === undefined ? current.finishedAt : patch.finishedAt,
      id,
    );
  return getScrapeRun(id);
}

export function getScrapeRun(id: string): ScrapeRun | null {
  const row = getDb()
    .prepare(`SELECT * FROM scrape_runs WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapRun(row) : null;
}

export function listScrapeRuns(limit = 20): ScrapeRun[] {
  const rows = getDb()
    .prepare(`SELECT * FROM scrape_runs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapRun);
}

export function makeDedupeKey(lead: {
  email?: string | null;
  linkedinUrl?: string | null;
  fullName?: string | null;
  companyName?: string | null;
}) {
  if (lead.email) return `email:${lead.email.trim().toLowerCase()}`;
  if (lead.linkedinUrl) {
    return `li:${lead.linkedinUrl.trim().toLowerCase().replace(/\/$/, "")}`;
  }
  const name = (lead.fullName || "").trim().toLowerCase();
  const company = (lead.companyName || "").trim().toLowerCase();
  if (name && company) return `nc:${name}|${company}`;
  return `id:${randomUUID()}`;
}

export function upsertLead(
  lead: Omit<Lead, "id" | "createdAt" | "updatedAt"> & { id?: string },
): { lead: Lead; inserted: boolean } {
  const database = getDb();
  const dedupeKey = lead.source === 'web' && lead.companyWebsite ? `web:${new URL(lead.companyWebsite).origin}` : makeDedupeKey(lead);
  const existing = database
    .prepare(`SELECT id FROM leads WHERE dedupe_key = ?`)
    .get(dedupeKey) as { id: string } | undefined;

  const ts = now();
  if (existing) {
    database
      .prepare(
        `UPDATE leads SET
          title = COALESCE(?, title),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          linkedin_url = COALESCE(?, linkedin_url),
          company_name = COALESCE(?, company_name),
          company_website = COALESCE(?, company_website),
          company_linkedin = COALESCE(?, company_linkedin),
          company_size = COALESCE(?, company_size),
          industry = COALESCE(?, industry),
          location = COALESCE(?, location),
          address = COALESCE(?, address),
          status = CASE WHEN status IN ('excluded','contacted','replied','qualified','archived') THEN status ELSE COALESCE(?, status) END,
          exclude_reason = COALESCE(?, exclude_reason),
          raw_json = COALESCE(?, raw_json),
          updated_at = ?
        WHERE id = ?`,
      )
      .run(
        lead.title,
        lead.email,
        lead.phone,
        lead.linkedinUrl,
        lead.companyName,
        lead.companyWebsite,
        lead.companyLinkedin,
        lead.companySize,
        lead.industry,
        lead.location,
        lead.address,
        lead.status,
        lead.excludeReason,
        lead.rawJson,
        ts,
        existing.id,
      );
    return { lead: getLead(existing.id)!, inserted: false };
  }

  const id = lead.id || randomUUID();
  database
    .prepare(
      `INSERT INTO leads (
        id, icp_id, scrape_run_id, source, full_name, first_name, last_name, title,
        email, phone, linkedin_url, company_name, company_website, company_linkedin,
        company_size, industry, location, address, status, exclude_reason, raw_json,
        dedupe_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      lead.icpId,
      lead.scrapeRunId,
      lead.source,
      lead.fullName,
      lead.firstName,
      lead.lastName,
      lead.title,
      lead.email,
      lead.phone,
      lead.linkedinUrl,
      lead.companyName,
      lead.companyWebsite,
      lead.companyLinkedin,
      lead.companySize,
      lead.industry,
      lead.location,
      lead.address,
      lead.status,
      lead.excludeReason,
      lead.rawJson,
      dedupeKey,
      ts,
      ts,
    );
  return { lead: getLead(id)!, inserted: true };
}

export function getLead(id: string): Lead | null {
  const row = getDb()
    .prepare(`SELECT * FROM leads WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapLead(row) : null;
}

export function listLeads(filters: LeadFilters = {}, limit = 500): Lead[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    clauses.push(
      `(full_name LIKE ? OR company_name LIKE ? OR email LIKE ? OR title LIKE ? OR industry LIKE ?)`,
    );
    const like = `%${filters.q}%`;
    params.push(like, like, like, like, like);
  }
  if (filters.status && filters.status !== "all") {
    clauses.push(`status = ?`);
    params.push(filters.status);
  }
  if (filters.source && filters.source !== "all") {
    clauses.push(`source = ?`);
    params.push(filters.source);
  }
  if (filters.icpId && filters.icpId !== "all") {
    clauses.push(`icp_id = ?`);
    params.push(filters.icpId);
  }
  if (filters.hasEmail) {
    clauses.push(`email IS NOT NULL AND email != ''`);
  }
  if (filters.hasLinkedin) {
    clauses.push(`linkedin_url IS NOT NULL AND linkedin_url != ''`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...params, limit) as Record<string, unknown>[];
  return rows.map(mapLead);
}

export function updateLeadStatus(
  id: string,
  status: LeadStatus,
  excludeReason?: string | null,
) {
  getDb()
    .prepare(
      `UPDATE leads SET status = ?, exclude_reason = ?, updated_at = ? WHERE id = ?`,
    )
    .run(status, excludeReason ?? null, now(), id);
  return getLead(id);
}

export function deleteLead(id: string) {
  getDb().prepare(`DELETE FROM leads WHERE id = ?`).run(id);
}

export function getStats() {
  const database = getDb();
  const leads = database
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'excluded' THEN 1 ELSE 0 END) as excluded,
        SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as with_email,
        SUM(CASE WHEN linkedin_url IS NOT NULL AND linkedin_url != '' THEN 1 ELSE 0 END) as with_linkedin
      FROM leads`,
    )
    .get() as Record<string, number>;
  const icps = database.prepare(`SELECT COUNT(*) as c FROM icps`).get() as {
    c: number;
  };
  const runs = database
    .prepare(`SELECT COUNT(*) as c FROM scrape_runs`)
    .get() as { c: number };
  return {
    totalLeads: Number(leads.total || 0),
    newLeads: Number(leads.new_count || 0),
    qualified: Number(leads.qualified || 0),
    excluded: Number(leads.excluded || 0),
    withEmail: Number(leads.with_email || 0),
    withLinkedin: Number(leads.with_linkedin || 0),
    icps: Number(icps.c || 0),
    scrapeRuns: Number(runs.c || 0),
  };
}

export function leadsToCsv(leads: Lead[]) {
  const headers = [
    "fullName",
    "title",
    "email",
    "phone",
    "linkedinUrl",
    "companyName",
    "companyWebsite",
    "companySize",
    "industry",
    "location",
    "status",
    "excludeReason",
    "source",
  ];
  const escape = (v: string | null | undefined) => {
    const s = v ?? "";
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const lead of leads) {
    lines.push(
      [
        lead.fullName,
        lead.title,
        lead.email,
        lead.phone,
        lead.linkedinUrl,
        lead.companyName,
        lead.companyWebsite,
        lead.companySize,
        lead.industry,
        lead.location,
        lead.status,
        lead.excludeReason,
        lead.source,
      ]
        .map((v) => escape(v as string | null))
        .join(","),
    );
  }
  return lines.join("\n");
}
