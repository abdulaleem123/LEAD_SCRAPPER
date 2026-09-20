import { createHash } from "node:crypto";
import type { Platform, Post, Settings, Verdict } from "./types";

type Row = Record<string, unknown>;
const obj = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const str = (...values: unknown[]) => values.find(v => typeof v === "string" && v.trim()) as string | undefined;
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); if (u.protocol !== "https:" || u.username || u.password) return null; u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k); return u.toString(); } catch { return null; }
}
export function isUpworkRelated(...values: unknown[]): boolean {
  return values.some(value => typeof value === 'string' && /\bupwork\b/i.test(value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'')));
}
export function timestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && /^\d{10,13}$/.test(value)) value = Number(value);
  const n = typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : Date.parse(String(value));
  return Number.isFinite(n) && n > Date.UTC(2000, 0, 1) ? new Date(n).toISOString() : null;
}
export function normalize(platform: Platform, input: unknown, now = new Date()): Post | null {
  const r = obj(input), a = obj(r.author || r.user || r.authorMeta || r.owner), record = obj(r.record), posted = obj(r.postedAt);
  const text = (platform === "reddit" ? [r.title, str(r.body, r.selftext, r.selfText, r.text)].filter(Boolean).join("\n") : str(r.text, r.content, r.caption, record.text, r.description, r.postText))?.trim();
  let url = safeUrl(str(r.postUrl, r.linkedinUrl, r.shareLinkedinUrl, r.url, r.webVideoUrl, r.post_url, r.link, r.permalink));
  if (platform === "reddit" && typeof r.permalink === "string" && r.permalink.startsWith("/r/")) url = safeUrl(`https://www.reddit.com${r.permalink}`);
  if (platform === "bluesky" && typeof r.uri === "string" && typeof a.did === "string") url = safeUrl(`https://bsky.app/profile/${a.did}/post/${r.uri.split("/").pop()}`);
  if (platform === "instagram" && !url && typeof r.shortCode === "string") url = safeUrl(`https://www.instagram.com/p/${r.shortCode}/`);
  const publishedAt = timestamp(str(posted.date) || posted.timestamp || r.publishedAt || r.createdAt || r.created_at || r.timestamp || r.time || r.created_utc || r.createdUtc || r.createTimeISO || r.createTime || record.createdAt || r.date || r.postedAt);
  if (!text || text.length < 12 || !url || !publishedAt || Date.parse(publishedAt) > now.getTime() + 60000) return null;
  const domains: Record<Platform, string[]> = { linkedin: ["linkedin.com"], x: ["x.com", "twitter.com"], facebook: ["facebook.com", "fb.com"], instagram: ["instagram.com"], reddit: ["reddit.com"], threads: ["threads.net", "threads.com"], bluesky: ["bsky.app"], tiktok: ["tiktok.com"], hackernews:['news.ycombinator.com'] };
  const host = new URL(url).hostname;
  if (!domains[platform].some(d => host === d || host.endsWith(`.${d}`))) return null;
  // Keep only post links; never treat profile creation time as a buying request.
  if (platform === "linkedin" && !/\/(posts|feed\/update)\//.test(new URL(url).pathname)) return null;
  if (platform === "x" && !/\/status\/\d+/.test(url)) return null;
  if (platform === 'hackernews' && (new URL(url).pathname !== '/item' || !/^\d+$/.test(new URL(url).searchParams.get('id') || ''))) return null;
  const author = str(a.name, a.displayName, a.fullName, a.nickname, a.userName, a.username, a.handle, r.authorName, r.ownerFullName, r.ownerUsername, r.username, r.author) || "Author not supplied";
  return { platform, postId: String(r.id || r.postId || r.uri || url), url, text: text.slice(0, 14000), author, authorUrl: safeUrl(str(a.url, a.profileUrl, a.linkedinUrl, r.authorUrl)), publishedAt, discoveredAt: now.toISOString() };
}
const servicePatterns: Record<string, RegExp> = {
  Websites: /\b(websites?|web\s?(?:design\w*|develop\w*)|landing page|wordpress|shopify|ecommerce|e-commerce)\b/i,
  Marketing: /\b(marketing|seo|ppc|google ads|facebook ads|lead generation|ad campaign)\b/i,
  Animation: /\b(animat(?:ion|ions|or|ors|e|ed|ing)|motion graphics|explainer video|3d artist)\b/i,
  "Social media": /\b(social media|socials|instagram manag|content creat|content manag|community manag)\b/i,
  "AI & automation": /\b(ai|artificial intelligence|chatbots?|automat(?:ion|e)|ai agents?|n8n|llm|agentic|RAG|retrieval[ -]augmented generation|knowledge base assistant)\b/i,
  "App development": /\b(app|application|software|mobile app|saas|developer)\b/i,
};
const request = /\b(?:(?:i|we|our\s+\w+)\s+(?:am\s+|are\s+)?(?:needs?|requires?|looking for|seeking|want(?:s)? to hire)|looking (?:for|to hire)|in search of|seeking (?:a|an|someone)|recommend (?:a|an|someone)|recommendations for|need (?:a|an|someone)|hiring|commission(?:ing)?(?: a| an)?|request for proposal|rfp)\b/i;
function buyingSentence(sentence: string, service: string) {
  const clean=sentence.trim().replace(/[’‘]/g,"'").replace(/\bI'm\b/gi,'I am').replace(/\bwe're\b/gi,'we are');
  if(clean.startsWith('>')) return false;
  const match=request.exec(clean);
  if(!match) return false;
  const prefix=clean.slice(0,match.index);
  if(/\b(?:you|your|anyone|anybody|whether|if|might|don't|doesn't|not|never)\b/i.test(prefix)) return false;
  if(/\b(?:do not|does not|don't|doesn't|no longer)\b/i.test(clean.slice(0,match.index+30))) return false;
  if(/^need\b/i.test(match[0]) && /[a-z]/i.test(prefix) && !/^(?:hi|hello|hey)[,!:\s]*$/i.test(prefix)) return false;
  if(clean.includes('?') && !/\b(?:i|we|my|our)\b/i.test(clean.slice(0,match.index+20))) return false;
  const nearby=clean.slice(match.index,match.index+180);
  return servicePatterns[service].test(nearby);
}
const seller = /\b(?:i|we) (?:offer|provide|speciali[sz]e|help businesses)|\b(?:my|our) services\b|\b(?:hire me|available for hire|open to work|for hire|dm me for|book a call|check out my portfolio)\b/i;
export function qualify(post: Post, settings: Settings, now = Date.now()): Verdict | null {
  if(isUpworkRelated(post.text,post.url,post.authorUrl)) return null;
  const age = now - Date.parse(post.publishedAt);
  if (!Number.isFinite(age) || age < -60000 || age > settings.maxAgeHours * 3600000) return null;
  const verdict = assessText(post.text, settings);
  return verdict ? {...verdict,score:Math.min(98,verdict.score+(age<=6*3600000?5:0))} : null;
}
// Content-only assessment does not invent a publication date or freshness bonus.
export function assessText(t: string, settings: Settings): Verdict | null {
  if(isUpworkRelated(t)) return null;
  if(settings.requireIndustry && settings.industries?.length && !settings.industries.some(term=>{
    const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`,'iu').test(t);
  })) return null;
  if(settings.excludeTerms.some(s=>t.toLowerCase().includes(s.toLowerCase()))) return null;
  const sentences = t.split(/(?<=[.!?\n])\s*/);
  const service = settings.services.find(s => sentences.some(line=>buyingSentence(line,s)));
  if (!service || seller.test(t) || /\b(no longer (?:need|looking)|position (?:is )?filled|found someone|not (?:looking|hiring)|don't need|do not need)\b/i.test(t)) return null;
  if (/\b(?:unpaid|not a paid|not paid|no budget|volunteer only|rev(?:enue)? share only|equity only|TOMT|tip of my tongue)\b/i.test(t)) return null;
  if (service === 'Animation' && /\b(?:animation (?:on youtube|i (?:saw|seen|watched)|from (?:my childhood|newgrounds))|lost media)\b/i.test(t)) return null;
  if(service === 'Animation' && /\b(?:video|animation)\b[\s\S]{0,70}\b(?:from (?:19|20)\d{2}|i (?:saw|watched|remember)|as a kid)\b/i.test(t)) return null;
  if (/\b(?:my|our|the) client (?:was|had been) looking for\b/i.test(t)) return null;
  if (/\b(?:looking for|need) (?:a )?websites? (?:to (?:read|watch|download|buy|stream)|where|for free)/i.test(t)) return null;
  if (service === "Websites" && /\b(hosting|domain registrar|domain services)\b/i.test(t) && !/\b(designer|developer|redesign|build (?:a|my|our|the) website|develop (?:a|my|our|the) website)\b/i.test(t)) return null;
  if (/^(?:if you(?:'re| are)|when you(?:'re| are)|are you) (?:looking|hiring|seeking)/i.test(t.trim())) return null;
  if (/\b(?:i|we) (?:build|create|design|develop|sell)\b[\s\S]{0,100}\b(?:for clients|for businesses|for you|dm me|contact me)\b/i.test(t)) return null;
  if (/\b(?:how (?:do|can|to)|tutorial|learn (?:to|how)|course|free tool|open.source alternative)\b/i.test(t) && !/\b(?:hire|hiring|budget|commission|paid project|pay someone)\b/i.test(t)) return null;
  const evidence = sentences.find(s => buyingSentence(s,service)) || '';
  if (!evidence) return null;
  const organization = /\b(our (?:school|company|business|organi[sz]ation|team|brand|startup)|school|university|nonprofit|non-profit|ngo|for (?:my|our) business)\b/i.test(t);
  if (settings.organizationOnly && !organization) return null;
  const budget = /(?:\$|£|€|USD|PKR|budget|paid project|paid work)/i.test(t);
  const urgency = /\b(urgent|asap|this week|deadline|immediately)\b/i.test(t);
  const employment = /\b(full.time|salary|benefits|per annum|apply with (?:your )?cv)\b/i.test(t);
  const score = Math.min(98, 70 + (organization ? 10 : 0) + (budget ? 10 : 0) + (urgency ? 5 : 0) - (employment ? 25 : 0));
  return { score, service, evidence: evidence.slice(0, 600), organization, method: "rules", reason: [`Explicit request for ${service.toLowerCase()}`, organization && "organization mentioned", budget && "budget/payment mentioned", urgency && "time-sensitive", employment && "may be an employment vacancy"].filter(Boolean).join(" · ") };
}
export function identity(post: Post) { return createHash("sha256").update(`${post.platform}:${post.url}`).digest("hex").slice(0, 32); }
export function fingerprint(post: Post) { return createHash("sha256").update(`${post.author.toLowerCase().replace(/\W/g, "")}:${post.text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\W/g, "")}`).digest("hex"); }
export function csvCell(value: unknown) { let s = String(value ?? ""); if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; }
