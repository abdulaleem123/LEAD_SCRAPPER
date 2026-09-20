const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
process.env.OPPORTUNITIES_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'free-discovery-'));
const {defaults}=require('../src/lib/opportunities/types.ts');
const {keywordPlan,collectFree,parseReddit,parseHN}=require('../src/lib/opportunities/free-sources.ts');
const {normalize,qualify}=require('../src/lib/opportunities/quality.ts');
const store=require('../src/lib/opportunities/store.ts');
const now=new Date().toISOString();
const post=text=>normalize('hackernews',{text,url:'https://news.ycombinator.com/item?id=123',publishedAt:now,author:'buyer'});
async function main(){
  const settings={...defaults,services:['Animation','Websites','AI & automation','App development'],maxAgeHours:168};
  const first=keywordPlan(settings,0),second=keywordPlan(settings,1);assert.notDeepEqual(first,second);assert.ok(first.includes('need an AI agent'));assert.deepEqual(keywordPlan({...settings,queries:['custom query']}),['custom query']);
  for(const text of ['I need someone to build an AI agent for our business. Budget $1000.','Looking for an animator for a paid project.','I am commissioning an animation for our business.','We need a software developer for our startup.','I need a website. Budget $2000.'])assert.ok(qualify(post(text),settings),text);
  for(const text of ['I build AI agents for businesses. Contact me!','Looking for a website? We offer web development services.','How can I build an AI agent? Need a tutorial.','I need a vacation. I build websites.','We need a software developer but found someone now.','Whether coding or using software, I wanted to do it on the road.','We wanted to build an analytics application without the pain.','Need a new website or software for your business?','Whether you need a business website, I can create one.','Anyone looking for a web designer?','It might need a better website.','Your business does not need a website.','Looking for an animation on YouTube from my childhood.','We need an animator. This is an unpaid project.'])assert.equal(qualify(post(text),settings),null,text);
  const reddit=parseReddit(`<feed><entry><id>abc</id><title>Need a website</title><content type="html">&lt;p&gt;Budget $2000&lt;/p&gt;</content><author><name>buyer</name></author><link href="https://www.reddit.com/r/forhire/comments/abc/request/"/><published>${now}</published></entry></feed>`);
  assert.equal(reddit.length,1);assert.ok(normalize('reddit',reddit[0]));assert.throws(()=>parseReddit('<html>Blocked</html>'));
  const hn=JSON.stringify({hits:[{objectID:'123',comment_text:'I need an AI agent. Budget $500.',created_at:now,author:'buyer'}]});assert.ok(normalize('hackernews',parseHN(hn)[0]));
  let requested=[];const result=await collectFree('hackernews',{...settings,maxItems:20},0,async url=>{requested.push(url);return hn;});assert.equal(requested.length,settings.services.length);assert.ok(result.rows.length<=20);
  await assert.rejects(()=>collectFree('linkedin',settings,0,async()=>{throw new Error('must not fetch');}),/unavailable in free/);
  let attempts=0;await assert.rejects(()=>collectFree('reddit',settings,0,async()=>{attempts++;throw new Error('HTTP 429');}),/429/);assert.equal(attempts,1);
  attempts=0;const partial=await collectFree('hackernews',settings,0,async()=>{if(attempts++===1)throw new Error('timeout');return hn;});assert.ok(partial.rows.length);assert.ok(partial.warnings.length);
  store.saveSettings({...settings,platforms:['linkedin'],aiReview:true});assert.equal(store.settings().aiReview,false);assert.deepEqual(store.settings().platforms,['linkedin']);
  // Credentials may exist, but the worker must never contact a paid endpoint.
  process.env.APIFY_TOKEN='test-do-not-use';process.env.OPENAI_API_KEY='test-do-not-use';
  const id=store.createScan({...settings,platforms:['hackernews'],aiReview:true});
  const oldFetch=global.fetch;global.fetch=async url=>{assert.equal(new URL(url).hostname,'hn.algolia.com');return new Response(hn);};
  try{await require('../src/lib/opportunities/worker.ts').tick();}finally{global.fetch=oldFetch;}
  const scan=store.scans()[0];assert.equal(scan.id,id);assert.equal(scan.status,'succeeded');assert.ok(store.listOpportunities().length);
  console.log('Free discovery checks passed: keyword rotation, buyer/seller intent, RSS/HN parsing, bounded requests, partial failure, rate limits, migration, and worker with zero paid calls.');store.db().close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
