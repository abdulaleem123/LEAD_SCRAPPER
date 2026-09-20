const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
process.env.OPPORTUNITIES_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'social-tests-'));
const {defaults}=require('../src/lib/opportunities/types.ts');
const {socialPostUrl,candidateFromResult,collectIndexed,indexedQuery}=require('../src/lib/opportunities/social-index.ts');
const {parsePublicSearch,searchPublic}=require('../src/lib/opportunities/public-search.ts');
const store=require('../src/lib/opportunities/store.ts');
const settings={...defaults,services:['Animation','Websites','AI & automation','App development']};
const links={instagram:'https://www.instagram.com/p/abc/',facebook:'https://www.facebook.com/groups/animation/permalink/123/',x:'https://twitter.com/person/status/123',linkedin:'https://www.linkedin.com/posts/person_activity-123',threads:'https://www.threads.net/@person/post/abc',tiktok:'https://www.tiktok.com/@person/video/123'};
async function main(){
  for(const [p,url] of Object.entries(links))assert.ok(socialPostUrl(url,p),p);
  for(const url of ['https://www.instagram.com/person','https://instagram.com.evil.test/p/abc','https://evil.test/p/abc','javascript:alert(1)','https://user:password@instagram.com/p/abc','https://instagram.com:9999/p/abc'])assert.equal(socialPostUrl(url,'instagram'),null,url);
  assert.equal(socialPostUrl('https://twitter.com/person/status/123?utm_source=test','x'),socialPostUrl('https://x.com/person/status/123','x'));
  const row={url:links.instagram,title:'I need an animator',content:'Looking for an animator for a paid project. Budget $500.',publishedAt:new Date().toISOString()};
  const candidate=candidateFromResult(row,'instagram',settings,'query');assert.ok(candidate);assert.equal(candidate.publishedAt,null);assert.equal(candidate.verified,false);assert.ok(candidate.evidence);
  assert.equal(candidateFromResult({...row,title:'Animator for hire',content:'I offer animation services. Hire me.'},'instagram',settings,'q'),null);
  assert.equal(candidateFromResult({...row,url:'https://news.example.com/article'},'instagram',settings,'q'),null);
  assert.equal(candidateFromResult({...row,title:'Hire Tommy Today!',content:'As a business owner looking to hire a website developer, I advise you watch this before spending your money.'},'instagram',settings,'q'),null);
  assert.notEqual(indexedQuery('instagram',settings,0),indexedQuery('instagram',settings,1));
  const parsed=parsePublicSearch('<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.instagram.com%2Fp%2Fabc%2F">I need an animator</a><div class="result__snippet">Paid project</div></div>');assert.equal(parsed.results[0].url,links.instagram);
  assert.throws(()=>parsePublicSearch('<form id="challenge-form" action="anomaly.js"></form>'),/human check/);
  assert.throws(()=>parsePublicSearch('<html>Unknown response</html>'),/unrecognized/);
  assert.equal(parsePublicSearch('<html>No results found</html>').results.length,0);
  const result=await collectIndexed('instagram',settings,0,async()=>({results:[row,row,{...row,url:'https://unrelated.test/post'}],warnings:[]}));assert.equal(result.candidates.length,1);assert.ok(result.warnings[0].includes('unrelated'));
  assert.ok(store.insertCandidate(candidate));store.editCandidate(candidate.id,'saved');assert.equal(store.insertCandidate(candidate),false);assert.equal(store.listCandidates()[0].status,'saved');assert.equal(store.listOpportunities().length,0);
  // A social source runs without contacting a paid provider or verifying a snippet as a post.
  process.env.APIFY_TOKEN='unused';process.env.OPENAI_API_KEY='unused';
  const original=global.fetch;const requests=[];
  global.fetch=async url=>{requests.push(String(url));const u=new URL(url);if(u.hostname==='127.0.0.1')throw new Error('Local engine absent');assert.equal(u.hostname,'html.duckduckgo.com');return new Response('<div class="result"><a class="result__a" href="https://www.facebook.com/groups/animation/permalink/123/">Looking for an animator</a><div class="result__snippet">I need an animator. Budget $500.</div></div>');};
  try{store.createScan({...settings,platforms:['facebook']});await require('../src/lib/opportunities/worker.ts').tick();assert.equal(store.scans()[0].status,'succeeded');assert.equal(store.listOpportunities().length,0);assert.equal(store.listCandidates().length,2);}finally{global.fetch=original;}
  global.fetch=async()=>new Response('',{status:429});try{await assert.rejects(()=>searchPublic('rate-limit-test'),/429/);let called=false;global.fetch=async()=>{called=true;return new Response('');};await assert.rejects(()=>searchPublic('after-limit'),/cooling down/);assert.equal(called,false);}finally{global.fetch=original;}
  console.log('Social discovery passed: six platforms, post URL checks, snippet provenance, paid-call isolation, worker, dedupe, human-check handling and cooldown.');store.db().close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
