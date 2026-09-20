# Sales OS — Lead Scraping Machine

Built from [I Built A Machine That Gets Me 1,000 Leads On Autopilot (Day 1)](https://www.youtube.com/watch?v=491FyUW_jfc) by Augmented AI.

Day-1 pipeline in one local app:

1. **ICP Generator** — Alex Berman / Patrick Dang / Eric Novoselov frameworks + OpenAI, Claude, or LM Studio  
2. **Search terms** — Apollo + LinkedIn + Apify JSON (with IT/tech excludes)  
3. **Apify scrape** — LinkedIn people or Google Maps local businesses  
4. **Auto-filter** — drop CTOs / IT directors / software companies  
5. **Lead CRM** — qualify, exclude, dedupe, CSV export  

## Quick start

```bash
cp .env.example .env
# fill APIFY_TOKEN + at least one AI key
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required env

| Key | Why |
|---|---|
| `APIFY_TOKEN` | Run scrapers ([Apify console](https://console.apify.com/account/integrations)) |
| `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` **or** LM Studio URL | ICP generation |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `lmstudio` |

Optional:

- `APIFY_LINKEDIN_ACTOR` — default `harvestapi/linkedin-profile-search` (swap if ratings change)
- `APIFY_MAPS_ACTOR` — default `compass/crawler-google-places`

## Recommended workflow (matches the video)

1. Open **ICP Generator** → pick Alex Berman → answer the diagnostic (or paste all answers at once).  
2. Review score, golden-goose sizing, exclude titles, and Apify search queries.  
3. Go to **Scrape Leads** → select that ICP → start with **25 or 50** leads.  
4. Check excluded IT/tech rows in **Lead CRM**, then scale to 500–1000.  
5. Export CSV for enrichment / outreach (Day 2 in the series).

## Stack

- Next.js (App Router) + TypeScript  
- SQLite (`data/sales-os.db`) via `better-sqlite3`  
- Apify client for actors  
- Zod-validated AI JSON for ICP + search cards  

## Notes

- Actors on Apify change over time — use the in-app actor suggestions or set `APIFY_LINKEDIN_ACTOR`.  
- Respect LinkedIn / site ToS and local privacy laws. Use data only for legitimate outreach.  
- Day 2 (enrich + validate) is intentionally stubbed as CRM statuses for now.
