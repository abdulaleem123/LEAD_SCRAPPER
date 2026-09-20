export const indexedPlatforms = ['instagram','facebook','x','linkedin','threads','tiktok'] as const;
export type IndexedPlatform=typeof indexedPlatforms[number];
export const candidatePlatforms=[...indexedPlatforms,'reddit','bluesky','hackernews'] as const;
export type CandidatePlatform=typeof candidatePlatforms[number];
export type SocialCandidate={
  id:string;platform:CandidatePlatform;url:string;title:string;snippet:string;service:string;score:number;evidence:string;
  source?:string;
  discoveredAt:string;publishedAt:null;status:'new'|'saved'|'dismissed';query:string;verified:false;currentMatch?:boolean;
};
