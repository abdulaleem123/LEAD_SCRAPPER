import { z } from 'zod';
import { createCrawl, controlCrawl, crawlerState, startCrawler } from '@/lib/crawler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { startCrawler(); return Response.json({jobs:crawlerState()}); }
export async function POST(req:Request) {
  if(req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return Response.json({error:'Invalid origin'},{status:403});
  try {
    const body = await req.json();
    if(body.action === 'start') {
      const parsed = z.object({urls:z.array(z.string().url()).min(1).max(2500),maxPages:z.number().int().min(1).max(10000),discover:z.boolean()}).parse(body);
      createCrawl(parsed.urls,parsed.maxPages,parsed.discover);
    } else {
      const parsed = z.object({id:z.number().int(),action:z.enum(['paused','running','cancelled'])}).parse(body);
      controlCrawl(parsed.id,parsed.action);
    }
    return Response.json({jobs:crawlerState()});
  } catch(error) {return Response.json({error:error instanceof Error ? error.message : 'Cannot start crawl'},{status:400});}
}
