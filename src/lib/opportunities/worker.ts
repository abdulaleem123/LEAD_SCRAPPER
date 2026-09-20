import { randomUUID } from "node:crypto";
import * as store from "./store";
import { collectFree, keywordPlan } from './free-sources';
import { collectIndexed, isIndexed } from './social-index';
import { normalize, qualify, identity, fingerprint } from "./quality";
import type { Job, Settings } from "./types";
const state = globalThis as typeof globalThis & { opportunityTimer?: ReturnType<typeof setInterval>; opportunityBusy?: boolean };
async function collect(job: Job, rows: unknown[], s: Settings) {
  const errors=rows.filter(r=>r && typeof r==="object" && ("error" in r || "errorDescription" in r));
  rows=rows.filter(r=>r && typeof r==="object" && !("noResults" in r) && !("error" in r) && !("errorDescription" in r));
  if(errors.length && !rows.length) throw new Error("The provider returned only error records, not posts. Check the source targets and provider run.");
  const posts=rows.map(r=>normalize(job.platform,r)).filter(p=>p!==null);
  if(rows.length && !posts.length) throw new Error("Results contained no readable posts with valid links and publication times. Check the provider output format.");
  const candidates = posts.map(post=>({post,verdict:qualify(post,s)})).filter((c): c is {post: NonNullable<typeof c.post>; verdict: NonNullable<typeof c.verdict>} => c.verdict!==null);
  const accepted = [];
  for (let i=0;i<candidates.length;i+=12) {
    const batch = candidates.slice(i,i+12);
    accepted.push(...batch);
  }
  let inserted=0;
  for (const c of accepted) if (c.verdict.score>=s.minScore) {
    if (store.insertOpportunity({...c.post,...c.verdict,id:identity(c.post),status:"new",notes:""},fingerprint(c.post))) inserted++;
  }
  store.updateJob(job.id,{status:"succeeded",fetched:rows.length,accepted:inserted,rejected:rows.length-accepted.filter(c=>c.verdict.score>=s.minScore).length,error:errors.length?`${errors.length} source targets failed; usable posts were processed.`:null});
}
export async function tick() {
  if (state.opportunityBusy || process.env.OPPORTUNITIES_WORKER_DISABLED === "1") return;
  state.opportunityBusy=true;
  const owner=randomUUID();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    if (!store.lease(owner)) return;
    heartbeat=setInterval(()=>store.lease(owner),30000);
    const settings=store.settings();
    if (!store.activeScan() && settings.enabled) {
      const latest=store.scans(1)[0];
      if ((!latest || Date.now()-Date.parse(latest.createdAt)>=settings.intervalMinutes*60000) && store.scansToday()<settings.maxScansPerDay) store.createScan(settings);
    }
    const scan=store.scans(5).find(s=>s.status==="running"); if (!scan) return;
    const cycle=(store.db().prepare("SELECT COUNT(*) n FROM opportunity_scans").get() as {n:number}).n-1;
    // Process one source per tick; interrupted free searches can safely be retried.
    const job=scan.jobs.find(j=>j.status==="starting") || scan.jobs.find(j=>j.status==="queued") || scan.jobs.filter(j=>j.status==="running").sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))[0];
    if (!job) {store.finishScan(scan.id);return;}
    try {
      if(job.actorRunId) throw new Error('Legacy paid run is no longer polled. Start a new free scan.');
      store.updateJob(job.id,{status:'starting',query:keywordPlan(scan.settings,cycle).join(' | ')});
      if(isIndexed(job.platform)) {
        const result=await collectIndexed(job.platform,scan.settings,cycle);
        let inserted=0;for(const c of result.candidates)if(store.insertCandidate(c))inserted++;
        store.updateJob(job.id,{status:'succeeded',query:result.query,fetched:result.fetched,accepted:inserted,rejected:result.fetched-result.candidates.length,error:result.warnings.join('; ').slice(0,400)||null});
      } else {
      const result=await collectFree(job.platform,scan.settings,cycle);
      await collect(job,result.rows,scan.settings);
      store.updateJob(job.id,{query:result.queries.join(' | '),error:result.warnings.length?result.warnings.join('; ').slice(0,400):null});
      }
    } catch(e) {store.updateJob(job.id,{status:"failed",error:e instanceof Error?e.message.slice(0,400):'Public source failed'});}
    store.finishScan(scan.id);
  } finally {if(heartbeat)clearInterval(heartbeat);store.release(owner);state.opportunityBusy=false;}
}
export function startWorker() {
  if (state.opportunityTimer || process.env.OPPORTUNITIES_WORKER_DISABLED === "1") return;
  state.opportunityTimer=setInterval(()=>{void tick().catch(()=>{/* Keep the server alive; next tick retries persistent work. */});},5000);
  state.opportunityTimer.unref();
}
