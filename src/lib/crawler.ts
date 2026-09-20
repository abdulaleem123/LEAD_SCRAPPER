import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import { upsertLead } from './db';

const agent = 'SalesOSCrawler';
export function publicIPv4(ip: string) {
  const p = ip.split('.').map(Number);
  return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    ![0,10,127].includes(p[0]) && p[0] < 224 &&
    !(p[0] === 169 && p[1] === 254) && !(p[0] === 172 && p[1] >= 16 && p[1] <= 31) &&
    !(p[0] === 192 && [0,168].includes(p[1])) && !(p[0] === 100 && p[1] >= 64 && p[1] <= 127) &&
    !(p[0] === 198 && [18,19].includes(p[1]));
}
export function normalizeUrl(value: string, base?: string) {
  const u = new URL(value, base);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || (u.port && !['80','443'].includes(u.port))) throw new Error('Use a public HTTP or HTTPS website.');
  u.hash = ''; return u.href;
}
async function fetchPage(value: string, redirects = 0, checkRobots = false): Promise<{text:string;url:string;status:number}> {
  if(checkRobots && !await allowed(value)) throw new Error('Disallowed by robots.txt.');
  const url = new URL(normalizeUrl(value));
  const addresses = await lookup(url.hostname, {family:4, all:true});
  if (!addresses.length || addresses.some(a => !publicIPv4(a.address))) throw new Error('Private or reserved network address blocked.');
  const result = await new Promise<{text:string;location?:string;status:number}>((resolve,reject) => {
    const req = (url.protocol === 'https:' ? request : httpRequest)(url, {
      family:4,
      headers:{'User-Agent':agent,'Accept':'text/html,text/plain'},
      lookup:(_host,_options,callback) => callback(null, addresses[0].address,4),
    }, res => {
      const chunks:Buffer[] = []; let size = 0;
      res.on('data', chunk => {size += chunk.length; if(size > 2_000_000) req.destroy(new Error('Page exceeds 2 MB limit.')); else chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',() => resolve({text:Buffer.concat(chunks).toString('utf8'),status:res.statusCode || 500,location:res.headers.location}));
    });
    const deadline = setTimeout(() => req.destroy(new Error('Website timed out.')),15000);
    req.on('close',() => clearTimeout(deadline)); req.on('error',reject); req.end();
  });
  if(result.status >= 300 && result.status < 400 && result.location) {
    if(redirects >= 4) throw new Error('Too many redirects.');
    return fetchPage(normalizeUrl(result.location,url.href),redirects+1,checkRobots);
  }
  return {...result,url:url.href};
}
let database: Database.Database;
function db() {
  if(database) return database;
  mkdirSync('data',{recursive:true}); database = new Database('data/crawler.db');
  database.pragma('journal_mode = WAL');
  database.exec(`CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, max_pages INTEGER, discover INTEGER, processed INTEGER DEFAULT 0, imported INTEGER DEFAULT 0, errors INTEGER DEFAULT 0, last_error TEXT, created TEXT);
    CREATE TABLE IF NOT EXISTS pages(job INTEGER,url TEXT,depth INTEGER,status TEXT DEFAULT 'queued',PRIMARY KEY(job,url));
    CREATE TABLE IF NOT EXISTS contacts(origin TEXT PRIMARY KEY,email TEXT,phone TEXT,name TEXT,source_url TEXT);`);
  database.prepare("UPDATE pages SET status='queued' WHERE status='running'").run();
  return database;
}
type Job = {id:number;status:string;max_pages:number;discover:number;processed:number;imported:number;errors:number;last_error:string|null};
export function crawlerState() { return db().prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 20').all(); }
export function createCrawl(urls:string[],maxPages:number,discover:boolean) {
  const d = db();
  if(d.prepare("SELECT id FROM jobs WHERE status IN ('running','paused')").get()) throw new Error('Finish or cancel the existing crawl first.');
  const normalized = urls.map(url => normalizeUrl(url));
  const id = d.prepare("INSERT INTO jobs(status,max_pages,discover,created) VALUES('running',?,?,?)").run(maxPages,Number(discover),new Date().toISOString()).lastInsertRowid;
  const add = d.prepare('INSERT OR IGNORE INTO pages(job,url,depth) VALUES(?,?,0)');
  d.transaction(() => normalized.forEach(url => add.run(id,url)))(); startCrawler(); return Number(id);
}
export function controlCrawl(id:number,status:'paused'|'running'|'cancelled') {
  db().prepare("UPDATE jobs SET status=? WHERE id=? AND status IN ('running','paused')").run(status,id); startCrawler();
}
const robots = new Map<string,ReturnType<typeof robotsParser>>();
async function allowed(url:string) {
  const origin = new URL(url).origin;
  if(!robots.has(origin)) {
    const result = await fetchPage(origin+'/robots.txt');
    if(result.status !== 404 && result.status !== 410 && result.status !== 200) throw new Error('Cannot verify robots.txt; site skipped.');
    robots.set(origin,robotsParser(origin+'/robots.txt',result.status === 200 ? result.text : ''));
  }
  const rules = robots.get(origin)!;
  if((rules.getCrawlDelay(agent) || 0) > 2) throw new Error('Site requires a slower crawl; skipped.');
  return rules.isAllowed(url,agent) !== false;
}
export function extract(html:string,url:string) {
  const $ = load(html); $('script,style,noscript').remove();
  const text = $.root().text();
  const candidates: string[] = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  $('a[href^="mailto:"]').each((_,a) => { candidates.unshift(($(a).attr('href') || '').slice(7).split('?')[0]); });
  const email = candidates.map(s => s.trim().toLowerCase()).find(s => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s) && !/\.(png|jpg|svg|webp)$|@(example\.|sentry\.)/i.test(s)) || null;
  const phone = $('a[href^="tel:"]').first().attr('href')?.slice(4) || null;
  const name = $('meta[property="og:site_name"]').attr('content') || $('title').text().trim().slice(0,160) || new URL(url).hostname;
  const links:string[] = []; $('a[href]').each((_,a) => {try {links.push(normalizeUrl($(a).attr('href')!,url));} catch {}});
  return {email,phone,name,links};
}
async function tick() {
  const d = db(); const job = d.prepare("SELECT * FROM jobs WHERE status='running' ORDER BY id LIMIT 1").get() as Job|undefined;
  if(!job) return;
  const page = d.prepare("SELECT url,depth FROM pages WHERE job=? AND status='queued' LIMIT 1").get(job.id) as {url:string;depth:number}|undefined;
  if(!page || job.processed >= job.max_pages) {d.prepare("UPDATE jobs SET status='completed' WHERE id=?").run(job.id);return;}
  d.prepare("UPDATE pages SET status='running' WHERE job=? AND url=?").run(job.id,page.url);
  try {
    if(!await allowed(page.url)) throw new Error('Disallowed by robots.txt.');
    const result = await fetchPage(page.url,0,true);
    if(result.status !== 200) throw new Error('Website returned HTTP '+result.status);
    // A redirected page is only parsed if its destination also permits crawling.
    if(result.url !== page.url && !await allowed(result.url)) throw new Error('Redirect destination disallows crawling.');
    const data = extract(result.text,result.url); const origin = new URL(result.url).origin;
    const existing = d.prepare('SELECT * FROM contacts WHERE origin=?').get(origin) as {email:string|null;phone:string|null;name:string}|undefined;
    if(data.email || data.phone) {
      const email = data.email || existing?.email || null, phone = data.phone || existing?.phone || null;
      // Stable company identity ensures enrichment does not duplicate the CRM row.
      upsertLead({source:'web',fullName:null,firstName:null,lastName:null,title:null,email,phone,linkedinUrl:null,companyName:existing?.name || data.name,companyWebsite:origin,companyLinkedin:null,companySize:null,industry:null,location:null,address:null,status:'new',excludeReason:null,icpId:null,scrapeRunId:null,rawJson:JSON.stringify({sourceUrl:result.url,foundAt:new Date().toISOString(),emailVerified:false})});
      d.prepare('INSERT OR REPLACE INTO contacts VALUES(?,?,?,?,?)').run(origin,email,phone,existing?.name || data.name,result.url);
      if(!existing) d.prepare('UPDATE jobs SET imported=imported+1 WHERE id=?').run(job.id);
    }
    let count = (d.prepare('SELECT COUNT(*) n FROM pages WHERE job=?').get(job.id) as {n:number}).n;
    const insert = d.prepare('INSERT OR IGNORE INTO pages(job,url,depth) VALUES(?,?,?)');
    for(const link of data.links) {
      if(count >= job.max_pages * 3) break;
      const target = new URL(link); const same = target.origin === origin;
      if(/linkedin\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com/.test(target.hostname)) continue;
      if(/\.(pdf|png|jpg|zip|mp4)$/i.test(target.pathname)) continue;
      if((same && /contact|about|team/i.test(target.pathname) && page.depth < 3) || (!same && job.discover && page.depth === 0)) {
        count += insert.run(job.id,same ? link : target.origin+'/',page.depth+1).changes;
      }
    }
  } catch(error) { d.prepare('UPDATE jobs SET errors=errors+1,last_error=? WHERE id=?').run(error instanceof Error ? error.message : 'Page failed',job.id); }
  d.prepare("UPDATE pages SET status='done' WHERE job=? AND url=?").run(job.id,page.url);
  d.prepare('UPDATE jobs SET processed=processed+1 WHERE id=?').run(job.id);
}
const globalCrawler = globalThis as typeof globalThis & {crawlerTimer?:ReturnType<typeof setInterval>;crawlerBusy?:boolean};
export function startCrawler() {
  if(globalCrawler.crawlerTimer) return;
  globalCrawler.crawlerTimer = setInterval(async () => {
    if(globalCrawler.crawlerBusy) return; globalCrawler.crawlerBusy = true;
    try {await tick();} catch(error) {console.error('Crawler worker:', error instanceof Error ? error.message : 'failed');} finally {globalCrawler.crawlerBusy = false;}
  },2000);
  globalCrawler.crawlerTimer.unref();
}
