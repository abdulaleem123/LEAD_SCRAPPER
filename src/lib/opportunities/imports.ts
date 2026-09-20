import {load} from 'cheerio';
import {candidatePlatforms} from './social-index-types';
import {candidateFromResult,socialPostUrl} from './social-index';
import {isUpworkRelated} from './quality';
import type {Settings} from './types';

type Row={url:string;title:string;content:string};
export function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('CSV contains an unclosed quoted field.');
  if(field||row.length){row.push(field);rows.push(row);}
  return rows;
}
export function parseImport(input:string):Row[]{
  const text=input.replace(/^\uFEFF/,'').trim();
  if(!text)throw new Error('Choose an export file first.');
  if(text.length>1_000_000)throw new Error('Keep imports below 1 MB.');
  if(text.startsWith('<')){
    if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('Feeds containing document types or entities are not supported.');
    const $=load(text,{xml:true});
    if(!$('rss,feed').length)throw new Error('Expected an RSS or Atom feed, not a webpage.');
    return $('item,entry').toArray().map(node=>{
      const e=$(node),markup=e.find('description,summary,content').first().text(),body=load(markup);
      const links=[e.find('link[rel="alternate"]').attr('href'),e.find('link').attr('href'),e.find('link').first().text(),...body('a[href]').toArray().map(a=>body(a).attr('href'))];
      const url=links.find(link=>candidatePlatforms.some(p=>socialPostUrl(link,p)))||links.find(Boolean)||'';
      return {url,title:e.find('title').first().text(),content:body.root().text()+(isUpworkRelated(markup,...links)?' [Upwork-related link]':'')};
    });
  }
  const convert=(r:Record<string,unknown>):Row=>{
    const fields=Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase().trim(),v]));
    const get=(...keys:string[])=>keys.map(k=>fields[k]).find(v=>typeof v==='string') as string||'';
    return {url:get('url','link','post url','permalink'),title:get('title'),content:get('text','snippet','content','post','description')};
  };
  if(text.startsWith('[')){
    const data:unknown=JSON.parse(text);
    if(!Array.isArray(data)||data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('JSON must be an array of post objects.');
    return data.map(convert);
  }
  const [head,...rows]=parseCsv(text);
  if(!head?.some(h=>/^(url|link|post url|permalink)$/i.test(h.trim())))throw new Error('CSV needs a URL column and a Text or Snippet column.');
  return rows.filter(r=>r.some(Boolean)).map(r=>convert(Object.fromEntries(head.map((h,i)=>[h,r[i]||'']))));
}
export function reviewImport(rows:Row[],settings:Settings,source:string){
  if(rows.length>1000)throw new Error('Import at most 1,000 rows at a time.');
  const candidates=[];let upwork=0,filtered=0;const seen=new Set<string>();let duplicates=0;
  for(const row of rows){
    if(isUpworkRelated(row.url,row.title,row.content)){upwork++;continue;}
    const platform=candidatePlatforms.find(p=>socialPostUrl(row.url,p));
    const candidate=platform&&candidateFromResult(row,platform,settings,'Imported post');
    if(!candidate){filtered++;continue;}
    if(seen.has(candidate.id)){duplicates++;continue;}seen.add(candidate.id);
    candidates.push({...candidate,source});
  }
  return {candidates,upwork,filtered,duplicates,total:rows.length};
}
