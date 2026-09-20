import { z } from "zod";

export const platforms = ["linkedin", "x", "facebook", "instagram", "reddit", "threads", "bluesky", "tiktok", "hackernews"] as const;
export const freePlatforms = ['instagram','facebook','x','linkedin','threads','tiktok','bluesky','reddit','hackernews'] as const;
export type Platform = typeof platforms[number];
export const services = ["Websites", "Marketing", "Animation", "Social media", "AI & automation", "App development"] as const;
export const settingsSchema = z.object({
  enabled: z.boolean().default(false),
  platforms: z.array(z.enum(platforms)).min(1).max(9).default([...freePlatforms]),
  services: z.array(z.enum(services)).min(1).default([...services]),
  queries: z.array(z.string().trim().min(3).max(100)).max(12).default([]),
  industries: z.array(z.string().trim().min(2).max(60)).max(20).default([]),
  requireIndustry: z.boolean().default(false),
  instagramTags: z.array(z.string().trim().regex(/^[\p{L}\p{N}_]+$/u)).max(12).default(["webdesignerneeded", "lookingforwebdesigner", "socialmediamanagerneeded", "animatorneeded"]),
  instagramAccounts: z.array(z.string().trim().regex(/^[a-zA-Z0-9_.]+$/)).max(10).default([]),
  intervalMinutes: z.number().int().min(5).max(1440).default(15),
  maxAgeHours: z.number().int().min(1).max(168).default(24),
  maxItems: z.number().int().min(10).max(100).default(30),
  maxScansPerDay: z.number().int().min(1).max(288).default(24),
  minScore: z.number().int().min(40).max(95).default(70),
  aiReview: z.boolean().default(false),
  organizationOnly: z.boolean().default(false),
  excludeTerms: z.array(z.string().trim().min(2).max(100)).max(30).default([]),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaults = settingsSchema.parse({});
export type Post = { platform: Platform; postId: string; url: string; text: string; author: string; authorUrl: string | null; publishedAt: string; discoveredAt: string };
export type Verdict = { score: number; service: string; reason: string; evidence: string; organization: boolean; method: "rules" | "ai"; reviewNote?: string };
export type Opportunity = Post & Verdict & { id: string; status: "new" | "saved" | "contacted" | "dismissed"; notes: string };
export type Job = { id: string; scanId: string; platform: Platform; status: string; actorRunId: string | null; datasetId: string | null; fetched: number; accepted: number; rejected: number; error: string | null; query: string; updatedAt: string };
export type Scan = { id: string; status: string; createdAt: string; finishedAt: string | null; settings: Settings; jobs: Job[] };
export const labels: Record<Platform, string> = { linkedin: "LinkedIn", x: "X / Twitter", facebook: "Facebook", instagram: "Instagram", reddit: "Reddit", threads: "Threads", bluesky: "Bluesky", tiktok: "TikTok", hackernews:'Hacker News' };
