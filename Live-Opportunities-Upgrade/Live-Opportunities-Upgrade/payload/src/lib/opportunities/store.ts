import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaults, settingsSchema, type Settings, type Opportunity, type Job, type Scan } from "./types";
let connection: Database.Database | undefined;
export function db() {
  if (connection) return connection;
  const directory = process.env.OPPORTUNITIES_DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  connection = new Database(path.join(directory, "opportunities.db"));
  connection.pragma("journal_mode = WAL"); connection.pragma("busy_timeout = 5000");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS opportunity_settings (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS opportunity_scans (id TEXT PRIMARY KEY, status TEXT NOT NULL, createdAt TEXT NOT NULL, finishedAt TEXT, settings TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS opportunity_jobs (id TEXT PRIMARY KEY, scanId TEXT NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL, actorRunId TEXT, datasetId TEXT, fetched INTEGER DEFAULT 0, accepted INTEGER DEFAULT 0, rejected INTEGER DEFAULT 0, error TEXT, query TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS opportunities (id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE NOT NULL, platform TEXT NOT NULL, publishedAt TEXT NOT NULL, score INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new', notes TEXT NOT NULL DEFAULT '', json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS opportunity_published ON opportunities(publishedAt);
    CREATE INDEX IF NOT EXISTS opportunity_scan_created ON opportunity_scans(createdAt);
    CREATE INDEX IF NOT EXISTS opportunity_job_scan ON opportunity_jobs(scanId);
    CREATE TABLE IF NOT EXISTS opportunity_lock (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);
  `);
  return connection;
}
export function settings(): Settings { const r = db().prepare("SELECT json FROM opportunity_settings WHERE id=1").get() as {json: string} | undefined; return r ? settingsSchema.parse(JSON.parse(r.json)) : structuredClone(defaults); }
export function saveSettings(s: Settings) { db().prepare("INSERT INTO opportunity_settings(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json").run(JSON.stringify(s)); }
export function scans(limit = 10): Scan[] {
  return (db().prepare("SELECT * FROM opportunity_scans ORDER BY createdAt DESC LIMIT ?").all(limit) as (Omit<Scan, "settings" | "jobs"> & {settings: string})[]).map(r => ({ ...r, settings: JSON.parse(r.settings), jobs: db().prepare("SELECT * FROM opportunity_jobs WHERE scanId=?").all(r.id) as Job[] }));
}
export function activeScan() { const r = db().prepare("SELECT id FROM opportunity_scans WHERE status='running' LIMIT 1").get() as {id: string} | undefined; return r?.id; }
export function scansToday() { return (db().prepare("SELECT COUNT(*) n FROM opportunity_scans WHERE createdAt>=?").get(new Date().toISOString().slice(0,10)) as {n: number}).n; }
export function createScan(s: Settings) {
  return db().transaction(() => {
    if (activeScan()) throw new Error("A scan is already running.");
    if (scansToday() >= s.maxScansPerDay) throw new Error("Daily scan limit reached. Adjust it in Search settings or wait until tomorrow (UTC).");
    const id = randomUUID(), now = new Date().toISOString();
    db().prepare("INSERT INTO opportunity_scans(id,status,createdAt,settings) VALUES(?,'running',?,?)").run(id, now, JSON.stringify(s));
    for (const p of [...new Set(s.platforms)]) db().prepare("INSERT INTO opportunity_jobs(id,scanId,platform,status,query,updatedAt) VALUES(?,?,?,'queued','',?)").run(randomUUID(), id, p, now);
    return id;
  }).immediate();
}
export function updateJob(id: string, changes: Partial<Job>) {
  const entries = Object.entries(changes).filter(([k]) => ["status", "actorRunId", "datasetId", "fetched", "accepted", "rejected", "error", "query"].includes(k));
  db().prepare(`UPDATE opportunity_jobs SET ${entries.map(([k]) => `${k}=?`).join(",")},updatedAt=? WHERE id=?`).run(...entries.map(([,v]) => v), new Date().toISOString(), id);
}
export function finishScan(id: string) {
  const jobs = db().prepare("SELECT status FROM opportunity_jobs WHERE scanId=?").all(id) as {status: string}[];
  if (jobs.some(j => ["queued", "starting", "running"].includes(j.status))) return;
  const good = jobs.filter(j => j.status === "succeeded").length;
  db().prepare("UPDATE opportunity_scans SET status=?,finishedAt=? WHERE id=?").run(good === jobs.length ? "succeeded" : good ? "partial" : "failed", new Date().toISOString(), id);
}
export function insertOpportunity(o: Opportunity, fingerprint: string) {
  // A repeat scan must never overwrite saved/contacted/dismissed decisions or notes.
  return db().prepare("INSERT OR IGNORE INTO opportunities(id,fingerprint,platform,publishedAt,score,json) VALUES(?,?,?,?,?,?)").run(o.id, fingerprint, o.platform, o.publishedAt, o.score, JSON.stringify(o)).changes > 0;
}
export function listOpportunities(limit = 2000): Opportunity[] {
  return (db().prepare("SELECT json,status,notes FROM opportunities ORDER BY publishedAt DESC LIMIT ?").all(limit) as {json: string; status: string; notes: string}[]).map(r => ({ ...JSON.parse(r.json), status: r.status, notes: r.notes }));
}
export function editOpportunity(id: string, status: string, notes: string) { return db().prepare("UPDATE opportunities SET status=?,notes=? WHERE id=?").run(status, notes, id).changes > 0; }
export function lease(owner: string) {
  return db().prepare("INSERT INTO opportunity_lock(id,owner,expires) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE opportunity_lock.expires<? OR opportunity_lock.owner=excluded.owner").run(owner, Date.now()+180000, Date.now()).changes > 0;
}
export function release(owner: string) { db().prepare("DELETE FROM opportunity_lock WHERE owner=?").run(owner); }
