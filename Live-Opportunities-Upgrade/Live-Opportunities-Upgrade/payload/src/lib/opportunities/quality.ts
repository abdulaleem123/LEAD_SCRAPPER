import { createHash } from "node:crypto";
import type { Platform, Post, Settings, Verdict } from "./types";

type Row = Record<string, unknown>;
const obj = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const str = (...values: unknown[]) => values.find(v => typeof v === "string" && v.trim()) as string | undefined;
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); if (u.protocol !== "https:" || u.username || u.password) return null; u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k); return u.toString(); } catch { return null; }
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
  const domains: Record<Platform, string[]> = { linkedin: ["linkedin.com"], x: ["x.com", "twitter.com"], facebook: ["facebook.com", "fb.com"], instagram: ["instagram.com"], reddit: ["reddit.com"], threads: ["threads.net", "threads.com"], bluesky: ["bsky.app"], tiktok: ["tiktok.com"] };
  const host = new URL(url).hostname;
  if (!domains[platform].some(d => host === d || host.endsWith(`.${d}`))) return null;
  // Keep only post links; never treat profile creation time as a buying request.
  if (platform === "linkedin" && !/\/(posts|feed\/update)\//.test(new URL(url).pathname)) return null;
  if (platform === "x" && !/\/status\/\d+/.test(url)) return null;
  const author = str(a.name, a.displayName, a.fullName, a.nickname, a.userName, a.username, a.handle, r.authorName, r.ownerFullName, r.ownerUsername, r.username, r.author) || "Author not supplied";
  return { platform, postId: String(r.id || r.postId || r.uri || url), url, text: text.slice(0, 14000), author, authorUrl: safeUrl(str(a.url, a.profileUrl, a.linkedinUrl, r.authorUrl)), publishedAt, discoveredAt: now.toISOString() };
}
const servicePatterns: Record<string, RegExp> = {
  Websites: /\b(websites?|web\s?(?:design\w*|develop\w*)|landing page|wordpress|shopify|ecommerce|e-commerce)\b/i,
  Marketing: /\b(marketing|seo|ppc|google ads|facebook ads|lead generation|ad campaign)\b/i,
  Animation: /\b(animat(?:ion|ions|or|ors|ed)|motion graphics|explainer video|3d artist)\b/i,
  "Social media": /\b(social media|socials|instagram manag|content creat|content manag|community manag)\b/i,
  "AI & automation": /\b(ai|artificial intelligence|chatbot|automat(?:ion|e)|ai agent|n8n)\b/i,
  "App development": /\b(app|application|software|mobile app|saas|developer)\b/i,
};
const request = /\b(?:(?:i|we|our\s+\w+)\s+(?:am\s+|are\s+)?(?:needs?|wants?|requires?|looking for|seeking)|looking (?:for|to hire)|in search of|seeking (?:a|an|someone)|can (?:anyone|someone)|recommend (?:a|an|someone)|recommendations for|need (?:a|an|someone)|hiring|wanted|required|request for proposal|rfp)\b/i;
const seller = /\b(?:i|we) (?:offer|provide|speciali[sz]e|help businesses)|\b(?:my|our) services\b|\b(?:hire me|available for hire|open to work|for hire|dm me for|book a call|check out my portfolio)\b/i;
export function qualify(post: Post, settings: Settings, now = Date.now()): Verdict | null {
  const age = now - Date.parse(post.publishedAt), t = post.text;
  if (age < -60000 || age > settings.maxAgeHours * 3600000 || settings.excludeTerms.some(s => t.toLowerCase().includes(s.toLowerCase()))) return null;
  const service = settings.services.find(s => servicePatterns[s].test(t));
  if (!service || seller.test(t) || /\b(no longer (?:need|looking)|position (?:is )?filled|found someone|not (?:looking|hiring)|don't need|do not need)\b/i.test(t)) return null;
  if (/\b(?:looking for|need) (?:a )?websites? (?:to (?:read|watch|download|buy|stream)|where|for free)/i.test(t)) return null;
  if (service === "Websites" && /\b(hosting|domain registrar|domain services)\b/i.test(t) && !/\b(designer|developer|redesign|build (?:a|my|our|the) website|develop (?:a|my|our|the) website)\b/i.test(t)) return null;
  if (/^(?:if you(?:'re| are)|when you(?:'re| are)|are you) (?:looking|hiring|seeking)/i.test(t.trim())) return null;
  const sentences = t.split(/(?<=[.!?\n])\s*/);
  const evidence = sentences.find(s => request.test(s) && servicePatterns[service].test(s)) || (request.test(t.slice(0, 600)) ? t.slice(0, 450) : "");
  if (!evidence) return null;
  const organization = /\b(our (?:school|company|business|organi[sz]ation|team|brand|startup)|school|university|nonprofit|non-profit|ngo|for (?:my|our) business)\b/i.test(t);
  if (settings.organizationOnly && !organization) return null;
  const budget = /(?:\$|£|€|USD|PKR|budget|paid project|paid work)/i.test(t);
  const urgency = /\b(urgent|asap|this week|deadline|immediately)\b/i.test(t);
  const employment = /\b(full.time|salary|benefits|per annum|apply with (?:your )?cv)\b/i.test(t);
  const score = Math.min(98, 70 + (organization ? 10 : 0) + (budget ? 10 : 0) + (urgency ? 5 : 0) + (age <= 6 * 3600000 ? 5 : 0) - (employment ? 25 : 0));
  return { score, service, evidence: evidence.slice(0, 600), organization, method: "rules", reason: [`Explicit request for ${service.toLowerCase()}`, organization && "organization mentioned", budget && "budget/payment mentioned", urgency && "time-sensitive", employment && "may be an employment vacancy"].filter(Boolean).join(" · ") };
}
export function identity(post: Post) { return createHash("sha256").update(`${post.platform}:${post.url}`).digest("hex").slice(0, 32); }
export function fingerprint(post: Post) { return createHash("sha256").update(`${post.author.toLowerCase().replace(/\W/g, "")}:${post.text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\W/g, "")}`).digest("hex"); }
export function csvCell(value: unknown) { let s = String(value ?? ""); if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; }
