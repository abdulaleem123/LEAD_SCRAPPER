# Social-media buyer discovery

## External sources and imports

The **More discovery sources & imports** panel links to RequestSignals, Talkwalker Alerts, Free Social Listening, Reddit Pro, Distill, changedetection.io, ClientRadar and Buska. These are external setup/browse links, not automatically connected subscriptions. No paid calls are enabled. RequestSignals DNS resolution failed on this computer even outside the sandbox, so direct collection was not implemented or advertised as working.

The working import endpoint `/api/opportunities/import` accepts CSV, JSON arrays and RSS/Atom files, up to 1 MB and 1,000 records. CSV needs URL and Text (or Snippet); JSON uses `url` and `text`. The UI also supports copying an individual post. Only supported original social post URLs are accepted. Redirect wrappers and ordinary webpage links are rejected; the endpoint never fetches uploaded URLs. Imports use saved targeting and local intent rules, retain the source label, deduplicate without resetting saved status, and keep publication dates unknown. Provider confidence scores are ignored. Imported results remain review candidates, not verified current buyers.

Upwork references are excluded from new matching, imports and API results for older stored records, including when the UI's current-rules filter is disabled. Existing records are preserved in storage.

Verified: `node scripts/test-discovery-imports.cjs`, existing discovery suites, TypeScript check, and a live import containing an Upwork request returned zero added / one excluded. External services were not signed into or purchased.

Official API research: [Meta's Threads collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api) includes keyword search; this requires an authorized token and permission. [X search](https://docs.x.com/x-api/posts/search/introduction) supports recent and archive search, with [metered API pricing](https://docs.x.com/x-api/getting-started/pricing). Neither is configured here. Meta developer pages for Instagram hashtag discovery and the Facebook Groups retirement returned access/rate-limit errors during this check; do not treat those APIs as a verified universal social-post search connection.

## Industry targeting and request vocabulary

Search settings now accepts arbitrary industry keywords, for example `school, schools, academy, education`. Leave this blank for all industries. Automatic queries rotate industries as well as service phrases. The optional strict industry filter requires one of those literal terms in the post; it does not infer the author's industry. Custom searches preserve your quotes and replace automatic queries.

AI & automation includes RAG and retrieval-augmented generation. Animation includes animate/animating lessons, and website queries include revamp/redesign requests. Matching remains local rules, not a trained intent model. The targeted regression checks are in `scripts/test-industry-intent.cjs`.

Research reviewed: [Crawl4AI](https://github.com/unclecode/crawl4ai) provides page extraction, [RSSHub](https://github.com/DIYgod/RSSHub) supplies source-specific feeds, and [ModernBERT zero-shot](https://huggingface.co/MoritzLaurer/ModernBERT-large-zeroshot-v2.0) classifies supplied text. None was installed in this update: they are not independent indexes of every social post. A model would need evaluation on real buyer/seller examples before replacing the existing filter. The existing optional [SearXNG integration](https://docs.searxng.org/dev/search_api.html) remains the route for self-hosted search aggregation, subject to upstream availability.

Open http://localhost:7000/opportunities. In Search settings choose Instagram, Facebook, X, LinkedIn, Threads or TikTok plus the services you sell. Leave custom searches empty to rotate service phrases automatically. Each indexed platform searches one phrase per scan to keep requests bounded.

## What runs without subscriptions

The app directly reads the public DuckDuckGo HTML search surface. No paid API, OpenAI key, cookies or social login is used. It checks each returned URL against the selected platform and supported post paths, rejects profiles and unrelated domains, and locally assesses the title/snippet for buying intent. Relevant links are saved under **Social posts to review**, with save/dismiss actions and CSV export.

These rows are **unverified search snippets**, with publication date explicitly unknown. Discovery time is not a post date. They never enter the timestamped Buying requests feed automatically. Click the original post to verify the author, full request, recency and whether replies are still welcome. Search indexes can omit posts, show outdated snippets, or find no matching requests. Private groups/accounts and login-only content are not scraped. This does not search every social-media post.

HTTP 202/403/429 and human-check pages stop collection and trigger a 15-minute in-process cooldown. Repeated identical queries are cached for five minutes. There is no CAPTCHA bypass, proxy rotation or paid fallback. The normal source-health panel reports errors; candidates from successful sources are kept. Existing records and saved decisions are preserved.

The current saved priority sources are Instagram, Facebook and X. Additional indexed sources are available in settings. Public Reddit, Hacker News and Bluesky collectors remain available, with their own availability limits. This update does not convert the separate legacy Find Leads/ICP features.

## Optional self-hosted search

SearXNG can aggregate multiple public search indexes through a local JSON endpoint. The project includes a loopback-only configuration under `search-service/`; it does not expose a search service to the network.

If Docker Desktop is already running, execute `powershell -File scripts/start-search.ps1`. This starts the official SearXNG image on 127.0.0.1:7080 with a generated local secret. The app prefers that engine when its health endpoint responds; otherwise it uses direct public search. Docker is optional for direct mode. The secret file is excluded by the existing `.env` gitignore rule. Stop only this helper with `docker compose -f search-service/compose.yaml down`.

The local container could not be started during this implementation session; direct public-search mode is the tested route. Self-hosting still depends on upstream engine availability and does not bypass social access restrictions.

References: https://docs.searxng.org/dev/search_api.html and https://docs.searxng.org/admin/installation-docker.html.

Tests: `node scripts/test-social-discovery.cjs`, `node scripts/test-free-discovery.cjs`, `node scripts/test-opportunities.cjs`, `npx tsc --noEmit`.
