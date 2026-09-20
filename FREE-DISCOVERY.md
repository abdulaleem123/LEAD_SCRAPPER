# Free buyer discovery

Update: Instagram, Facebook, X, LinkedIn, Threads and TikTok indexed-post discovery is now also available. See SOCIAL-DISCOVERY.md for the current setup, verification labels, cooldown behavior, and optional SearXNG helper. The direct-feed notes below describe the original Reddit/Hacker News/Bluesky path.

Open http://localhost:7000/opportunities. Choose services in Search settings, leave Custom searches empty, then select Find opportunities. The app generates English search phrases for animation, websites, software, AI agents and automation (plus marketing/social media if selected). Alternatives rotate between scans. Set your lookback to 168 hours to search the last week.

Live Opportunities now uses public sources and local intent rules only. No Apify, OpenAI or other paid call is made by this worker, even if those keys remain configured for other app features. The separate legacy Find Leads and ICP features are not converted by this change.

## Sources

- Reddit public search RSS. Live testing returned data, but later requests were rate-limited. The worker stops requests to a source when it returns 403 or 429 and displays the error. See https://www.reddit.com/r/reddit.com/wiki/rss/.
- Hacker News public search at https://hn.algolia.com/api. Searches posts and comments with original publication dates and links.
- Bluesky public search. The endpoint returned 403 on this network during verification, so it is available to select but not enabled in the saved settings. See https://docs.bsky.app/docs/api/app-bsky-feed-search-posts.

No login-wall bypasses, paid fallbacks or guaranteed platform coverage. Public services can change or block access. This is an independent search-and-filter application, not an independent copy of the whole web. It still needs internet access to public sources.

## Quality and limits

The local classifier requires a present buying request close to the service phrase, rejects common seller pitches, tutorials, resolved requests, historical narratives and unpaid work, and records the matching evidence. Scores are heuristics, not buying probabilities. No verified email or buyer budget is invented. Review the original post before outreach.

Current targeting is reapplied to stored posts for display; the default checkbox hides records that no longer qualify. Turn that checkbox off to inspect previous records. Saved status and notes are retained. There is no automatic geography filter or guarantee of US buyers.

The worker persists scans, deduplicates posts, limits request sizes and deadlines, processes sources independently, and never lets a failed source discard the others' matches. A source can complete only part of its queries; warnings appear in Source health. Monitoring runs only while the local app stays on and must be enabled in the app.

Tests: `node scripts/test-free-discovery.cjs`, `node scripts/test-opportunities.cjs`, `npx tsc --noEmit`. Tests use isolated data and simulate a complete worker scan while rejecting any non-public-source endpoint.
