import { z } from "zod";
import { settingsSchema, freePlatforms } from "@/lib/opportunities/types";
import * as store from "@/lib/opportunities/store";
import { startWorker } from "@/lib/opportunities/worker";
import { freeCoverage, keywordPlan } from '@/lib/opportunities/free-sources';
import { qualify, isUpworkRelated } from '@/lib/opportunities/quality';
import { isIndexed, searchHealth, candidateFromResult } from '@/lib/opportunities/social-index';
import { publicSearchRetryAt } from '@/lib/opportunities/public-search';
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  startWorker();
  const settings=store.settings();
  const opportunities=store.listOpportunities().filter(o=>!isUpworkRelated(o.text,o.url,o.authorUrl)).map(o=>{const verdict=qualify(o,settings);return {...o,...(verdict||{}),currentMatch:!!verdict&&verdict.score>=settings.minScore};});
  const localSearchReady=await searchHealth();
  const candidates=store.listCandidates().filter(c=>!isUpworkRelated(c.title,c.snippet,c.url)).map(c=>({...c,currentMatch:!!candidateFromResult({url:c.url,title:c.title,content:c.snippet},c.platform,settings,c.query)}));
  return Response.json({settings,opportunities,localSearchReady,searchRetryAt:publicSearchRetryAt(),candidates,scans:store.scans(),scansToday:store.scansToday(),aiAvailable:false,keywordPlan:keywordPlan(settings,Math.max(0,(store.db().prepare('SELECT COUNT(*) n FROM opportunity_scans').get() as {n:number}).n)),sources:freePlatforms.map(platform=>({platform,ready:true,coverage:isIndexed(platform)?'Public indexed post links. Snippets require review; publication dates are unknown.':freeCoverage[platform]}))});
}
export async function POST(req: Request) {
  try {
    const origin=req.headers.get("origin"); if(origin && origin!==new URL(req.url).origin) return Response.json({error:"Cross-origin changes are not allowed."},{status:403});
    const body=await req.json();
    if(body.action==="settings") {store.saveSettings(settingsSchema.parse(body.settings));startWorker();return Response.json({ok:true});}
    if(body.action==="scan") {const settings=store.settings();if(settings.platforms.every(isIndexed)&&publicSearchRetryAt()&&!await searchHealth())return Response.json({error:'Social search is cooling down after a rate limit or human check. Wait until the shown retry time.'},{status:429});const id=store.createScan(settings);startWorker();return Response.json({id},{status:202});}
    if(body.action==='candidate') {const data=z.object({id:z.string().min(1),status:z.enum(['new','saved','dismissed'])}).parse(body);if(!store.editCandidate(data.id,data.status))return Response.json({error:'Candidate not found'},{status:404});return Response.json({ok:true});}
    if(body.action==="update") {const data=z.object({id:z.string().min(1),status:z.enum(["new","saved","contacted","dismissed"]),notes:z.string().max(5000)}).parse(body);if(!store.editOpportunity(data.id,data.status,data.notes)) return Response.json({error:"Opportunity not found"},{status:404});return Response.json({ok:true});}
    return Response.json({error:"Unknown action"},{status:400});
  } catch(e) {return Response.json({error:e instanceof z.ZodError ? "Check your settings: select services and platforms, and use valid limits and hashtags." : e instanceof Error ? e.message : "Request failed"},{status:400});}
}
