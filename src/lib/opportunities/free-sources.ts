import {load} from 'cheerio';
import type {Platform,Settings} from './types';

export const phrases: Record<string,string[]> = {
  Websites:['need a website','looking for a web designer','need someone to revamp','looking to redesign our website','hire a website developer','website redesign'],
  Marketing:['looking for a marketing agency','need an SEO expert','hire a marketing freelancer','SEO project'],
  Animation:['looking for an animator','need an animation','need someone to animate','commission animation','looking for motion graphics','explainer video'],
  'Social media':['looking for a social media manager','hire a content creator','social media freelancer'],
  'AI & automation':['need an AI agent','looking for an AI developer','need a RAG developer','retrieval augmented generation','need someone to automate','chatbot developer','automation expert','build a custom AI agent','n8n workflow'],
  'App development':['need a software developer','looking for an app developer','custom software project','hire a developer','build an app'],
};
export function keywordPlan(settings:Settings,cycle=0) {
  if(settings.queries.length) return [...new Set(settings.queries)];
  const industry=settings.industries?.length ? settings.industries[Math.floor(cycle/2)%settings.industries.length] : '';
  return settings.services.flatMap(s=>{const list=phrases[s]||[];return [list[cycle%list.length],list[(cycle+1)%list.length]];}).filter(Boolean).map(q=>industry ? `${q} ${industry}` : q);
}
export const freeCoverage:Partial<Record<Platform,string>>={
  bluesky:'Public keyword search; no key required. Availability and indexing vary.',
  reddit:'Public search RSS; some networks are blocked or rate-limited. No bypass or paid fallback.',
  hackernews:'Public posts and comments through the HN search index. Mostly software and startup discussions.',
};
export type FreeResult={rows:unknown[];warnings:string[];queries:string[]};
export async function readPublic(url:string):Promise<string> {
  // Only fixed public source hosts are requested. No user-supplied fetch destinations.
  const host=new URL(url).hostname;
  if(!['public.api.bsky.app','www.reddit.com','hn.algolia.com'].includes(host)) throw new Error('Unknown public source');
  const r=await fetch(url,{headers:{'User-Agent':'SalesOSBuyerDiscovery/1.0','Accept':'application/json,application/atom+xml'},signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});
  if(!r.ok)throw new Error(`Public source returned HTTP ${r.status}${r.status===403?' (access blocked)':r.status===429?' (rate limited)':''}. No paid fallback was used.`);
  const reader=r.body?.getReader();if(!reader)throw new Error('Empty source response');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>2_000_000){await reader.cancel();throw new Error('Source response too large');}chunks.push(item.value);}
  return Buffer.concat(chunks).toString('utf8');
}
export function parseReddit(xml:string):unknown[] {
  const $=load(xml,{xml:true});
  if(!$('feed').length)throw new Error('Reddit did not return a public feed.');
  return $('entry').toArray().map(entry=>{
    const e=$(entry);const content=load(e.find('content').text()).root().text();
    return {id:e.find('id').text(),title:e.find('title').text(),selftext:content,
      url:e.find('link[rel="alternate"]').attr('href')||e.find('link').attr('href'),
      author:e.find('author name').text(),authorUrl:e.find('author uri').text(),publishedAt:e.find('published').text()||e.find('updated').text()};
  });
}
export function parseHN(body:string):unknown[] {
  const data=JSON.parse(body);if(!Array.isArray(data.hits))throw new Error('Unexpected Hacker News response');
  return data.hits.filter((h:Record<string,unknown>)=>/^\d+$/.test(String(h.objectID))).map((h:Record<string,unknown>)=>({
    id:h.objectID,text:load([h.title,h.story_text,h.comment_text].filter(Boolean).join('\n')).root().text(),
    url:`https://news.ycombinator.com/item?id=${h.objectID}`,publishedAt:h.created_at,
    author:h.author,authorUrl:`https://news.ycombinator.com/user?id=${encodeURIComponent(String(h.author||''))}`,
  }));
}
export async function collectFree(platform:Platform,s:Settings,cycle:number,read=readPublic):Promise<FreeResult> {
  if(!(platform in freeCoverage))throw new Error('This source is unavailable in free discovery. Select Bluesky, Reddit or Hacker News.');
  const qs=keywordPlan(s,cycle);const rows:unknown[]=[];const warnings:string[]=[];let successful=0;
  // Each selected service gets a query, with alternatives rotating on later scans.
  const selected=qs.filter((_,i)=>s.queries.length||i%2===0).slice(0,12);
  const perQuery=Math.max(1,Math.floor(s.maxItems/selected.length));
  const since=new Date(Date.now()-s.maxAgeHours*3600000);
  for(const q of selected){
    try{
      let url:URL;
      if(platform==='bluesky'){
        url=new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts');url.search=new URLSearchParams({q,sort:'latest',limit:String(perQuery),since:since.toISOString()}).toString();
      }else if(platform==='reddit'){
        url=new URL('https://www.reddit.com/search.rss');url.search=new URLSearchParams({q,sort:'new',t:'week',limit:String(perQuery),type:'link'}).toString();
      }else{
        url=new URL('https://hn.algolia.com/api/v1/search_by_date');url.search=new URLSearchParams({query:q.replace(/"/g,''),hitsPerPage:String(perQuery),numericFilters:`created_at_i>${Math.floor(+since/1000)}`}).toString();
      }
      const raw=await read(url.href);let items:unknown[];
      if(platform==='reddit')items=parseReddit(raw);
      else if(platform==='hackernews')items=parseHN(raw);
      else{const parsed=JSON.parse(raw);if(!Array.isArray(parsed.posts))throw new Error('Unexpected Bluesky response');items=parsed.posts;}
      rows.push(...items.slice(0,perQuery));successful++;
    }catch(e){const message=e instanceof Error?e.message:'Source unavailable';warnings.push(message);if(/403|429/.test(message))break;}
    // A bounded, sequential scan respects source capacity.
    if(read===readPublic)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!successful)throw new Error(warnings[0]||'No public searches could complete');
  return {rows:rows.slice(0,s.maxItems),warnings:[...new Set(warnings)],queries:selected};
}
