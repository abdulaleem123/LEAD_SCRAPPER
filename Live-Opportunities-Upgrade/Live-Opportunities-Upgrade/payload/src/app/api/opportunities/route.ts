import { z } from "zod";
import { settingsSchema, platforms } from "@/lib/opportunities/types";
import * as store from "@/lib/opportunities/store";
import { startWorker } from "@/lib/opportunities/worker";
import { actors, coverage } from "@/lib/opportunities/sources";
import { aiAvailable } from "@/lib/opportunities/review";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  startWorker();
  return Response.json({settings:store.settings(),opportunities:store.listOpportunities(),scans:store.scans(),scansToday:store.scansToday(),aiAvailable:aiAvailable(),sources:platforms.map(platform=>({platform,ready:platform==="bluesky" || !!process.env.APIFY_TOKEN,coverage:coverage[platform],actor:actors[platform]}))});
}
export async function POST(req: Request) {
  try {
    const origin=req.headers.get("origin"); if(origin && origin!==new URL(req.url).origin) return Response.json({error:"Cross-origin changes are not allowed."},{status:403});
    const body=await req.json();
    if(body.action==="settings") {store.saveSettings(settingsSchema.parse(body.settings));startWorker();return Response.json({ok:true});}
    if(body.action==="scan") {const id=store.createScan(store.settings());startWorker();return Response.json({id},{status:202});}
    if(body.action==="update") {const data=z.object({id:z.string().min(1),status:z.enum(["new","saved","contacted","dismissed"]),notes:z.string().max(5000)}).parse(body);if(!store.editOpportunity(data.id,data.status,data.notes)) return Response.json({error:"Opportunity not found"},{status:404});return Response.json({ok:true});}
    return Response.json({error:"Unknown action"},{status:400});
  } catch(e) {return Response.json({error:e instanceof z.ZodError ? "Check your settings: select services and platforms, and use valid limits and hashtags." : e instanceof Error ? e.message : "Request failed"},{status:400});}
}
