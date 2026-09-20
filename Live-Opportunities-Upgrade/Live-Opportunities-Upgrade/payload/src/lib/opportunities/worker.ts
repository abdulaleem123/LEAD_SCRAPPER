import { randomUUID } from "node:crypto";
import * as store from "./store";
import { actors, actorInput, bluesky, client, sourceError } from "./sources";
import { normalize, qualify, identity, fingerprint } from "./quality";
import { aiAvailable, review } from "./review";
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
    if (s.aiReview && aiAvailable()) {
      try { accepted.push(...await review(batch)); }
      catch { accepted.push(...batch.map(c=>({...c,verdict:{...c.verdict,reviewNote:"AI unavailable; rule-based match. Review the original post before approaching."}}))); }
    } else accepted.push(...batch);
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
    // Process one job per tick. Persisted actor IDs let the next server process resume polling.
    const job=scan.jobs.find(j=>j.status==="starting") || scan.jobs.find(j=>j.status==="queued") || scan.jobs.filter(j=>j.status==="running").sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))[0];
    if (!job) {store.finishScan(scan.id);return;}
    try {
      if (job.status==="starting") throw new Error("The app restarted while starting this source. Check recent Apify runs before retrying; the request may have been accepted.");
      if (job.status==="queued") {
        const spec=actorInput(job.platform,scan.settings,cycle);
        store.updateJob(job.id,{status:"starting",query:spec.query});
        let directDone=false;
        if (job.platform==="bluesky") {
          try {await collect(job,await bluesky(scan.settings,cycle),scan.settings);directDone=true;}
          catch(e) {if(!process.env.APIFY_TOKEN)throw e;}
        }
        if (!directDone) {
          if (!process.env.APIFY_TOKEN) throw new Error("Add APIFY_TOKEN to the app environment to connect this source.");
          const actor=process.env[`OPPORTUNITIES_${job.platform.toUpperCase()}_ACTOR`] || actors[job.platform]!;
          const run=await client().actor(actor).start(spec.input,{timeout:240,maxItems:scan.settings.maxItems,maxTotalChargeUsd:job.platform==="tiktok"?0.50:0.25});
          store.updateJob(job.id,{status:"running",actorRunId:run.id,datasetId:run.defaultDatasetId});
        }
      } else {
        const run=await client().run(job.actorRunId!).get();
        if (!run) throw new Error("Provider run could not be found.");
        if (["READY","RUNNING","TIMING-OUT","ABORTING"].includes(run.status)) store.updateJob(job.id,{status:"running"});
        else if (run.status!=="SUCCEEDED") throw new Error(`Source ended with ${run.status}. Open its Apify run for details.`);
        else { const data=await client().dataset(run.defaultDatasetId).listItems({limit:scan.settings.maxItems}); await collect(job,data.items,scan.settings); }
      }
    } catch(e) {store.updateJob(job.id,{status:"failed",error:sourceError(e)});}
    store.finishScan(scan.id);
  } finally {if(heartbeat)clearInterval(heartbeat);store.release(owner);state.opportunityBusy=false;}
}
export function startWorker() {
  if (state.opportunityTimer || process.env.OPPORTUNITIES_WORKER_DISABLED === "1") return;
  state.opportunityTimer=setInterval(()=>{void tick().catch(()=>{/* Keep the server alive; next tick retries persistent work. */});},5000);
  state.opportunityTimer.unref();
}
