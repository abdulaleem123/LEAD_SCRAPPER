import {z} from 'zod';
import {boundedText} from '@/lib/opportunities/public-search';
import {parseImport,reviewImport} from '@/lib/opportunities/imports';
import * as store from '@/lib/opportunities/store';
export const runtime='nodejs';
export async function POST(req:Request){
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Cross-origin imports are not allowed.'},{status:403});
  try{
    const raw=await boundedText(new Response(req.body));
    const body=z.object({content:z.string().max(1_000_000),source:z.string().trim().min(1).max(80)}).parse(JSON.parse(raw));
    const result=reviewImport(parseImport(body.content),store.settings(),body.source);
    let added=0,duplicates=result.duplicates;
    store.db().transaction(()=>{for(const c of result.candidates){if(store.insertCandidate(c))added++;else duplicates++;}})();
    return Response.json({added,duplicates,upwork:result.upwork,filtered:result.filtered,total:result.total});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Import failed.'},{status:400});}
}
