# Live Opportunities

Open `/opportunities` in Sales OS. Choose Search settings, save your services, then select Find opportunities. The existing ICP, profile scraping, Maps and CRM flows remain independent.

## Included sources

- LinkedIn: public keyword post search through `harvestapi/linkedin-post-search`, date sorted.
- X: public keyword post search through `apidojo/tweet-scraper`, latest sorted.
- Facebook: public keyword post search through `scraper_one/facebook-posts-search`, latest sorted. One search phrase per scan rotates through the campaign. Private groups are not covered.
- Instagram: chosen hashtags and public accounts through `apify/instagram-scraper`. This is not unrestricted caption search.
- Reddit: public keyword post search through `blubberstick/reddit-scraper`, newest sorted.
- Threads: public keyword search through `sleek_waveform/threads-scraper`. Availability depends on the provider.
- Bluesky: public search endpoint, with an Apify fallback (`newpo/bluesky-scraper`) when direct search fails. Server access and rate limits may vary.
- TikTok: caption search through `clockworks/tiktok-scraper`, latest videos. Audio/video is not transcribed.

These adapters are not a guarantee of complete platform coverage. Provider changes, indexing delays, access, paid plans and quotas affect results. Empty or failed sources are reported individually, never filled with demonstration leads.

## Qualification and freshness

The scanner requires a public source URL, post text and parseable publication time. Missing dates and future dates are rejected. Source date filters are followed by a local age check. The feed separately displays publication time and first discovery time.

Rules look for explicit requests in the selected service categories and reject seller advertising, resolved requests, excluded terms and stale posts. Optional AI reviews rule-selected candidates with the existing OpenAI, Anthropic or LM Studio settings. Each accepted AI result must cite an exact substring of the post. If AI fails, the row says it is rule-based. Scores describe buying intent, not likelihood of closing a sale. English patterns are the default; custom queries alone do not add multilingual classification.

The original post is the source of truth: confirm the request is still open. No messages are sent automatically. Save, contacted, dismiss and notes are stored locally. CSV exports the currently filtered results and escapes spreadsheet formulas.

## Monitoring and limits

Monitoring is paused initially. Start monitoring enables a persistent schedule checked by the local Next.js server. The browser can close, but the computer and server must stay running. Desktop notifications require this page to remain open and browser permission.

Defaults: 15-minute interval, 24-hour age limit, 30 posts per source, 24 scans per UTC day. Increasing the daily limit permits more checks. Each actor gets a 240-second execution limit and a requested $0.25 event-charge cap ($0.50 for TikTok). Apify platform compute, subscriptions and AI usage may be additional; this is not a total billing guarantee. A cap can make some actors fail or return no usable data. Provider-run links are shown for diagnosis.

Queued work, actor run IDs and results are persisted in `data/opportunities.db`, separate from `data/sales-os.db`. A database lease prevents concurrent workers. Completed provider runs resume after restart. A restart during an ambiguous actor-start request reports a failure rather than creating another potentially paid run automatically. A scan with one failed source can still preserve matches from successful sources.

## Configuration

The existing `APIFY_TOKEN`, `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` and LM Studio settings are reused. No keys are returned to the browser.

Optional environment variables:

- `OPPORTUNITIES_DATA_DIR`: isolated database directory for tests or a separate installation.
- `OPPORTUNITIES_WORKER_DISABLED=1`: disable background processing (testing/maintenance).
- `OPPORTUNITIES_<PLATFORM>_ACTOR`: override an actor only with one accepting the same input/output contract. Names include LINKEDIN, X, FACEBOOK, INSTAGRAM, REDDIT, THREADS, TIKTOK.

This extends the existing local application; it does not add public deployment or multi-user authentication.

## Verification

`node scripts/test-opportunities.cjs` uses isolated fixture data and a temporary database; it does not contact providers or open the CRM database. Also run `npx tsc --noEmit`, lint the new paths, and `npm run build -- --webpack`.

Provider references: https://apify.com/harvestapi/linkedin-post-search/input-schema, https://apify.com/apidojo/tweet-scraper/input-schema, https://apify.com/scraper_one/facebook-posts-search/input-schema, https://apify.com/apify/instagram-scraper/input-schema, https://apify.com/blubberstick/reddit-scraper, https://apify.com/sleek_waveform/threads-scraper, https://apify.com/clockworks/tiktok-scraper/input-schema, https://docs.bsky.app/docs/api/app-bsky-feed-search-posts.
