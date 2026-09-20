'use client';
import {useState} from 'react';

const sources=[
  {name:'RequestSignals',url:'https://requestsignals.com/leads',access:'Free browsing · external',detail:'Browse service requests and open their original posts. Automatic access could not be verified from this computer. Copy relevant post text and its original link below.'},
  {name:'Talkwalker Alerts',url:'https://www.talkwalker.com/alerts',access:'Free alerts · account setup',detail:'Create alerts for buyer phrases across the web and X. Download your RSS alert feed, then import the XML file below. Only supported social post links are accepted.'},
  {name:'Free Social Listening',url:'https://freesociallistening.com/pricing',access:'Limited free plan · external',detail:'Five keywords on Reddit and X with daily scans. LinkedIn is paid. Export supported post URLs and text to CSV for import.'},
  {name:'Reddit Pro',url:'https://www.business.reddit.com/pro',access:'Free · Reddit account',detail:'Use Trends to find keyword conversations. Copy a relevant post link and text below. This does not connect your Reddit account to this app.'},
  {name:'Distill',url:'https://distill.io/pricing/',access:'Limited free monitoring · external',detail:'Watch selected accessible pages for changes. Copy matching social posts below. It does not search all social platforms.'},
  {name:'changedetection.io',url:'https://changedetection.io/',access:'Self-hostable · separate setup',detail:'Monitor selected pages on your own machine. Import supported RSS exports or copy individual matching posts. No local installation is configured here.'},
  {name:'ClientRadar',url:'https://getclientradar.com/pricing/',access:'Paid for full lead details · not connected',detail:'Its free Facebook preview blurs lead details. Listed for comparison; no subscription or paid calls are enabled.'},
  {name:'Buska',url:'https://www.buska.io/pricing',access:'Paid after trial · not connected',detail:'Broader social listening with paid plans. Listed for comparison; no subscription or paid calls are enabled.'},
];
export function DiscoverySources({onImported}:{onImported:()=>Promise<void>}){
  const [content,setContent]=useState(''),[source,setSource]=useState('External alert'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [url,setUrl]=useState(''),[post,setPost]=useState('');
  async function submit(value:string){
    setBusy(true);setMessage('');setError('');
    try{
      const response=await fetch('/api/opportunities/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:value,source})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Import failed');
      setMessage(`${result.added} added for review · ${result.duplicates} duplicates · ${result.upwork} Upwork-related excluded · ${result.filtered} outside current targeting or unsupported links.`);
      await onImported();
    }catch(e){setError(e instanceof Error?e.message:'Import failed');}finally{setBusy(false);}
  }
  return <details className="opp-sources"><summary>More discovery sources & imports</summary>
    <p>Upwork-related posts are excluded from results and imports. These services open separately; adding this panel does not connect accounts or enable paid services.</p>
    <div className="opp-source-grid">{sources.map(s=><article key={s.name}><h3>{s.name}</h3><strong>{s.access}</strong><p>{s.detail}</p><a href={s.url} target="_blank" rel="noreferrer" className="btn btn-secondary">Open {s.name} ↗</a></article>)}</div>
    <section className="opp-settings"><h3>Bring a request into your lead list</h3>
      <p className="opp-help">Imports use your saved service and industry settings. Dates and provider confidence scores are not treated as verified. Results appear in Social posts to review with their original links.</p>
      <label>Source name<input maxLength={80} value={source} onChange={e=>setSource(e.target.value)}/></label>
      <div className="opp-settings-grid"><div><label>Original social post URL<input placeholder="https://www.facebook.com/groups/.../posts/..." value={url} onChange={e=>setUrl(e.target.value)}/></label><label>Post text<textarea rows={4} placeholder="Paste the buyer's actual request here" value={post} onChange={e=>setPost(e.target.value)}/></label><button className="btn btn-primary" disabled={busy||!url||!post||!source.trim()} onClick={()=>void submit(JSON.stringify([{url,text:post}]))}>Check and import post</button></div>
      <div><label>Import CSV, JSON, RSS or Atom<input type="file" accept=".csv,.json,.xml,.rss,.atom" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];setContent('');setError('');if(!file)return;if(file.size>1_000_000){setError('Choose a file smaller than 1 MB.');return;}try{setContent(await file.text());}catch{setError('Could not read that file.');}}}/></label><p className="opp-help">CSV columns: URL and Text (or Snippet), optionally Title. JSON: an array with url and text fields. Up to 1,000 rows per import. Unsupported websites and indirect search links are skipped.</p><button className="btn btn-primary" disabled={busy||!content||!source.trim()} onClick={()=>void submit(content)}>{busy?'Checking…':'Import and filter file'}</button></div></div>
      {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="opp-bad">{error}</p>}
    </section>
    <p className="opp-help">For a future official connection, Threads offers public keyword search with permission. X offers keyword search with metered pricing. Instagram hashtag discovery and Facebook page access do not provide a universal buyer-post search.</p>
  </details>;
}
