import {load} from 'cheerio';

export type SearchResults={results:Record<string,unknown>[];warnings:string[]};
const state=globalThis as typeof globalThis & {publicSearchUntil?:number;publicSearchCache?:Map<string,{expires:number;data:SearchResults}>};
export function publicSearchRetryAt(){return (state.publicSearchUntil||0)>Date.now()?state.publicSearchUntil!:null;}

export function parsePublicSearch(html:string):SearchResults {
  const $=load(html);
  if($('form[action*="anomaly"],#challenge-form').length||/unfortunately, bots use duckduckgo/i.test($.root().text()))throw new Error('Public search requested a human check. Automatic searches are paused; no bypass was attempted.');
  const results:Record<string,unknown>[]=[];
  $('.result').each((_,node)=>{
    const a=$(node).find('.result__a');let href=a.attr('href');if(!href)return;
    try{
      const target=new URL(href,'https://html.duckduckgo.com');
      if(target.hostname==='duckduckgo.com'&&target.pathname==='/l/')href=target.searchParams.get('uddg')||'';
      else href=target.href;
      results.push({url:href,title:a.text().trim(),content:$(node).find('.result__snippet').text().trim()});
    }catch{/* Unreadable search links are discarded. */}
  });
  if(!results.length&&!/no results|no more results/i.test($.root().text()))throw new Error('Public search returned an unrecognized page, not confirmed results.');
  return {results,warnings:[]};
}
export async function boundedText(response:Response){
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty search response');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2_000_000){await reader.cancel();throw new Error('Search response too large');}chunks.push(part.value);}
  return Buffer.concat(chunks).toString('utf8');
}
export async function searchPublic(query:string):Promise<SearchResults>{
  if((state.publicSearchUntil||0)>Date.now())throw new Error('Public search is cooling down after a rate limit or human check. Try again in 15 minutes.');
  const cache=state.publicSearchCache ||= new Map();
  const existing=cache.get(query);if(existing&&existing.expires>Date.now())return existing.data;
  const url=new URL('https://html.duckduckgo.com/html/');url.searchParams.set('q',query);
  try{
    const r=await fetch(url,{headers:{'User-Agent':'SalesOSBuyerDiscovery/1.0','Accept':'text/html'},redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});
    if([202,403,429].includes(r.status)){state.publicSearchUntil=Date.now()+15*60000;throw new Error(`Public search returned HTTP ${r.status}. Searches paused for 15 minutes; no paid fallback.`);}
    if(!r.ok)throw new Error(`Public search returned HTTP ${r.status}.`);
    const data=parsePublicSearch(await boundedText(r));
    if(cache.size>=100)cache.delete(cache.keys().next().value!);
    cache.set(query,{expires:Date.now()+5*60000,data});return data;
  }catch(error){
    if(error instanceof Error&&/human check/.test(error.message))state.publicSearchUntil=Date.now()+15*60000;
    if(error instanceof TypeError)throw new Error('Public search could not connect. Check internet access and retry later.');
    throw error;
  }
}
