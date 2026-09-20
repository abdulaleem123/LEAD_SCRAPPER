import { ApifyClient } from "apify-client";
import type { Platform, Settings } from "./types";

export const actors: Partial<Record<Platform,string>> = {
  linkedin: "harvestapi/linkedin-post-search", x: "apidojo/tweet-scraper", facebook: "scraper_one/facebook-posts-search", instagram: "apify/instagram-scraper", reddit: "blubberstick/reddit-scraper", threads: "sleek_waveform/threads-scraper", tiktok: "clockworks/tiktok-scraper", bluesky: "newpo/bluesky-scraper",
};
export const coverage: Record<Platform,string> = {
  linkedin: "Public post search, newest first", x: "Public post search, newest first", facebook: "Public post search; private groups are not included", instagram: "Hashtags and chosen public accounts; captions only", reddit: "Public post search, newest first", threads: "Public keyword search; availability varies", bluesky: "Public post search, newest first", tiktok: "Video caption search; spoken requests are not transcribed",
};
export const client = () => new ApifyClient({ token: process.env.APIFY_TOKEN, maxRetries: 1, timeoutSecs: 20 });
const serviceQueries: Record<string,string[]> = {
  Websites: ['"looking for a web designer"', '"need a website"', '"website developer needed"'],
  Marketing: ['"looking for a marketing agency"', '"need an SEO"', '"looking for an ads specialist"'],
  Animation: ['"looking for an animator"', '"need an animation"', '"need an explainer video"'],
  "Social media": ['"looking for a social media manager"', '"need a social media manager"', '"hiring a content creator"'],
  "AI & automation": ['"looking for an AI developer"', '"need a chatbot"', '"looking for an automation expert"'],
  "App development": ['"looking for an app developer"', '"build an app for"', '"need a software developer"'],
};
export function queries(s: Settings, cycle: number) { return s.queries.length ? s.queries : s.services.map(service => serviceQueries[service][cycle % 3]); }
export function actorInput(p: Platform, s: Settings, cycle: number) {
  const qs = queries(s, cycle), q = qs[cycle % qs.length], since = new Date(Date.now()-s.maxAgeHours*3600000).toISOString();
  const n = s.maxItems;
  switch(p) {
    case "linkedin": return { input: {searchQueries: qs, maxPosts: Math.max(1, Math.floor(n/qs.length)), postedLimitDate: since, sortBy: "date"}, query: qs.join(" | ") };
    case "x": return { input: {searchTerms: qs.map(t => `${t} -filter:retweets`), maxItems: n, sort: "Latest", start: since.slice(0,10)}, query: qs.join(" | ") };
    case "facebook": return {input: {query: q, resultsCount: n, searchType: "latest", startDate: since.slice(0,10)}, query: q};
    case "instagram": {
      const targets = [...s.instagramTags.map(t => `https://www.instagram.com/explore/tags/${t}/`), ...s.instagramAccounts.map(t => `https://www.instagram.com/${t}/`)];
      if (!targets.length) throw new Error("Add Instagram hashtags or public accounts in Search settings.");
      return {input: {directUrls: targets, resultsType: "posts", resultsLimit: Math.max(1,Math.floor(n/targets.length)), onlyPostsNewerThan: since}, query: [...s.instagramTags.map(t => `#${t}`),...s.instagramAccounts.map(t => `@${t}`)].join(", ")};
    }
    case "reddit": return {input: {searchQueries: qs, searchSort: "new", sort: "new", maxItems: n, includeComments: false}, query: qs.join(" | ")};
    case "threads": return {input: {scrapeMode: "search", searchQueries: qs, maxItems: n, includeReplies: false, includeReposts: false}, query: qs.join(" | ")};
    case "bluesky": return {input: {searchQueries: qs, maxPosts: n, includeReplies: false, includeReposts: false}, query: qs.join(" | ")};
    case "tiktok": return {input: {searchQueries: qs, searchSection: "/video", videoSearchSorting: "LATEST", videoSearchDateFilter: s.maxAgeHours<=24 ? "PAST_24_HOURS" : "PAST_WEEK", resultsPerPage: Math.max(1,Math.floor(n/qs.length)), shouldDownloadVideos: false, shouldDownloadCovers: false}, query: qs.join(" | ")};
    default: return {input: {}, query: q};
  }
}
export async function bluesky(s: Settings, cycle: number): Promise<unknown[]> {
  const items: unknown[] = [];
  for (const q of queries(s,cycle)) {
    const u = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts");
    u.search = new URLSearchParams({q, sort: "latest", limit: String(Math.max(1,Math.floor(s.maxItems/queries(s,cycle).length))), since: new Date(Date.now()-s.maxAgeHours*3600000).toISOString()}).toString();
    const r = await fetch(u, {signal: AbortSignal.timeout(12000)});
    if (!r.ok) throw new Error(`Bluesky search returned ${r.status}. Retry later or check service availability.`);
    const body = await r.json(); if (!Array.isArray(body.posts)) throw new Error("Bluesky returned an unexpected response.");
    items.push(...body.posts);
  }
  return items.slice(0,s.maxItems);
}
export function sourceError(e: unknown) {
  const message = e instanceof Error ? e.message : "Source request failed";
  if (/token|unauthor|401/i.test(message)) return "Connection was rejected. Check the Apify token in the app's environment file.";
  if (/402|credit|payment|rent|subscription|paid plan|charge|insufficient/i.test(message)) return "This source needs available Apify credit or an actor subscription. Check its Apify run.";
  if (/429|rate.limit/i.test(message)) return "The source is rate-limited. It will be retried on a later scan.";
  if (/timeout|timed.out/i.test(message)) return "The source timed out. Try again on a later scan.";
  return message.replace(/apify_api_[\w-]+/g,"[redacted]").replace(/https?:\/\/\S+/g,"[provider URL]").slice(0,240);
}
