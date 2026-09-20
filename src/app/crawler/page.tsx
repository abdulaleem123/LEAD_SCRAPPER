'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Job={id:number;status:string;processed:number;max_pages:number;imported:number;errors:number;last_error:string|null};
export default function CrawlerPage() {
  const [urls,setUrls]=useState(''),[maxPages,setMaxPages]=useState(100),[discover,setDiscover]=useState(false),[jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true; const refresh=async()=>{try {const r=await fetch('/api/crawler');if(!r.ok)throw new Error('Cannot load crawler');const data=await r.json();if(active)setJobs(data.jobs);}catch(e){if(active)setError(String(e));}};void refresh();const timer=setInterval(refresh,3000);return()=>{active=false;clearInterval(timer);};},[]);
  async function send(body:object){setBusy(true);setError('');try{const r=await fetch('/api/crawler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error);setJobs(data.jobs);}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
  return <div className="space-y-6"><div><h1 className="display text-3xl font-bold">Web Crawler</h1><p className="text-[var(--muted)]">Find published business contacts. No scraping subscription or API key required.</p></div>
    <section className="panel rounded-3xl p-6 space-y-4"><h2 className="text-xl font-semibold">Start with websites</h2><p>Paste business websites, one per line. For a chamber of commerce or school directory, enable linked business discovery. Only sites with a published email or phone are saved to your CRM.</p>
    <label className="block">Website URLs<textarea className="w-full border rounded-xl p-3 mt-2" rows={7} value={urls} onChange={e=>setUrls(e.target.value)} placeholder={'https://business-website.com\nhttps://directory-website.com/members'}/></label>
    <label className="block"><input type="checkbox" checked={discover} onChange={e=>setDiscover(e.target.checked)}/> Discover business websites linked from starting pages</label>
    <label className="block">Maximum pages to check <input className="border rounded p-2" type="number" min={1} max={10000} value={maxPages} onChange={e=>setMaxPages(Number(e.target.value))}/></label>
    <p className="text-sm text-[var(--muted)]">Up to 2,500 starting URLs and 10,000 pages per crawl. Page limits are not guaranteed lead counts. Public HTML only; login-only and JavaScript-only content may be unavailable. Emails are published addresses, not verified inboxes. Progress resumes when the app restarts.</p>
    <button disabled={busy||!urls.trim()} className="btn btn-primary" onClick={()=>send({action:'start',urls:urls.split(/\s+/).filter(Boolean),maxPages,discover})}>Start crawl</button> <Link className="btn btn-secondary" href="/leads">Open Lead CRM</Link>
    {error&&<p role="alert" className="text-red-700">{error}</p>}</section>
    {jobs.map(j=><section key={j.id} className="panel rounded-2xl p-5 space-y-2"><strong>Crawl #{j.id} · {j.status}</strong><p>{j.processed} / {j.max_pages} pages checked · {j.imported} new businesses · {j.errors} skipped pages</p>{j.last_error&&<p className="text-sm">Last skip: {j.last_error}</p>}{['running','paused'].includes(j.status)&&<div className="flex gap-2"><button disabled={busy} className="btn btn-secondary" onClick={()=>send({id:j.id,action:j.status==='running'?'paused':'running'})}>{j.status==='running'?'Pause':'Resume'}</button><button disabled={busy} className="btn btn-secondary" onClick={()=>send({id:j.id,action:'cancelled'})}>Cancel</button></div>}</section>)}
  </div>;
}
