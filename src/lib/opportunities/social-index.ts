import { createHash } from 'node:crypto';
import { assessText, safeUrl, isUpworkRelated } from './quality';
import { keywordPlan } from './free-sources';
import type {Platform, Settings} from './types';
import { searchPublic, boundedText } from './public-search';

import { indexedPlatforms, type IndexedPlatform, type CandidatePlatform, type SocialCandidate } from './social-index-types';
export {indexedPlatforms, type SocialCandidate} from './social-index-types';
const domains:Record<CandidatePlatform,string[]>={instagram:['instagram.com'],facebook:['facebook.com'],x:['x.com','twitter.com'],linkedin:['linkedin.com'],threads:['threads.net','threads.com'],tiktok:['tiktok.com'],reddit:['reddit.com'],bluesky:['bsky.app'],hackernews:['news.ycombinator.com']};
export function isIndexed(p:Platform):p is IndexedPlatform{return indexedPlatforms.some(s=>s===p);}
export function socialPostUrl(value:unknown,p:CandidatePlatform):string|null{
  const clean=safeUrl(value);if(!clean)return null;
  const url=new URL(clean),host=url.hostname.toLowerCase().replace(/^www\./,'');
  if(url.port)return null;
  if(!domains[p].some(d=>host===d||host===`m.${d}`))return null;
  const path=url.pathname;
  const valid=p==='reddit'?/^\/r\/[^/]+\/comments\/[a-z0-9]+(?:\/|$)/i.test(path):
    p==='bluesky'?/^\/profile\/[^/]+\/post\/[^/]+/.test(path):
    p==='hackernews'?path==='/item'&&/^\d+$/.test(url.searchParams.get('id')||''):
    p==='instagram'?/^\/(?:p|reel|reels)\/[^/]+/.test(path):
    p==='facebook'?/\/(?:posts|videos|reel|permalink)\/[^/]+/.test(path)||(/^\/(?:story|permalink)\.php$/.test(path)&&!!url.searchParams.get('story_fbid')):
    p==='x'?/^\/[^/]+\/status\/\d+/.test(path):
    p==='linkedin'?/^\/(?:posts|feed\/update)\//.test(path):
    p==='threads'?/^\/@[^/]+\/post\/[^/]+/.test(path):
    /^\/@[^/]+\/video\/\d+/.test(path);
  if(!valid)return null;
  if(p==='x')url.hostname='x.com';
  if(p==='threads')url.hostname='www.threads.com';
  for(const key of [...url.searchParams.keys()])if(!['story_fbid','id'].includes(key))url.searchParams.delete(key);
  url.pathname=url.pathname.replace(/\/$/,'');return url.href;
}
export function indexedQuery(p:IndexedPlatform,s:Settings,cycle:number){
  const phrases=keywordPlan(s,cycle);
  const phrase=phrases[(cycle+indexedPlatforms.indexOf(p))%phrases.length].replace(/[\r\n]/g,' ').trim();
  const sites=domains[p].map(d=>`site:${d}`).join(' OR ');
    return `(${sites}) ${phrase}`;
}
export function candidateFromResult(row:Record<string,unknown>,p:CandidatePlatform,s:Settings,query:string):SocialCandidate|null{
  if(isUpworkRelated(row.url,row.title,row.content))return null;
  const url=socialPostUrl(row.url,p);if(!url)return null;
  const title=typeof row.title==='string'?row.title.slice(0,400):'';
  const snippet=typeof row.content==='string'?row.content.slice(0,2000):'';
  if(/\bhire\b.{0,45}\btoday\b/i.test(title)||/\b(?:i advise|before spending your|before hiring|tips for hiring|how to hire|we compare value)\b/i.test(snippet))return null;
  const verdict=assessText(`${title}\n${snippet}`,s);
  if(!verdict||verdict.score<s.minScore)return null;
  return {id:createHash('sha256').update(url).digest('hex').slice(0,32),platform:p,url,title,snippet,service:verdict.service,score:verdict.score,evidence:verdict.evidence,query,verified:false,publishedAt:null,discoveredAt:new Date().toISOString(),status:'new'};
}
const endpoint='http://127.0.0.1:7080';
export async function searchHealth(){
  try{const r=await fetch(`${endpoint}/healthz`,{signal:AbortSignal.timeout(2000),redirect:'error',cache:'no-store'});return r.ok;}catch{return false;}
}
export async function searchLocal(query:string){
  if(!await searchHealth())return searchPublic(query);
  const url=new URL('/search',endpoint);url.search=new URLSearchParams({q:query,format:'json',language:'en',categories:'general',safesearch:'1'}).toString();
  let response:Response;
  try{response=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error',cache:'no-store'});}catch{throw new Error('Local search is not reachable. Start the local search service, then retry.');}
  if(!response.ok)throw new Error(`Local search returned ${response.status}. No paid service was called.`);
  const data=JSON.parse(await boundedText(response));
  if(!Array.isArray(data.results))throw new Error('Search returned an unexpected response');
  const unavailable=Array.isArray(data.unresponsive_engines)?data.unresponsive_engines.map((r:unknown)=>Array.isArray(r)?String(r[0]):'search engine'):[];
  return {results:data.results as Record<string,unknown>[],warnings:unavailable.length?[`Some search engines could not respond: ${unavailable.join(', ')}`]:[]};
}
export async function collectIndexed(p:IndexedPlatform,s:Settings,cycle:number,search=searchLocal){
  const query=indexedQuery(p,s,cycle);const result=await search(query);
  const all=result.results.slice(0,s.maxItems);
  const candidates=all.map(r=>candidateFromResult(r,p,s,query)).filter((c):c is SocialCandidate=>c!==null);
  const ignored=all.filter(r=>!socialPostUrl(r.url,p)).length;
  const warnings=[...result.warnings];if(ignored)warnings.push(`${ignored} unrelated or non-post results discarded.`);
  return {query,fetched:all.length,candidates:[...new Map(candidates.map(c=>[c.id,c])).values()],warnings};
}
