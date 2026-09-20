# Web Crawler

Open http://localhost:7000/crawler. No Apify or AI key is needed.

Paste public business websites, one per line. For directory pages, enable discovery to follow external website links from those starting pages. Contact/about/team pages are followed automatically. Begin with 100 pages; larger batches accept 2,500 seeds and 10,000 pages. The count measures pages checked, not guaranteed qualified leads.

Progress is saved in data/crawler.db. Keep the local app running; jobs resume on startup. Pause or cancel from the page. Each website with an email or telephone becomes one CRM business record with source `web`. Repeated visits enrich that record. Missing email stays blank. Published email does not imply deliverability, and a directory's own contact can also be collected: review before outreach.

The crawler checks robots.txt, uses bounded downloads and timeouts, blocks private network destinations including redirects, and processes pages sequentially. Sites requesting a crawl delay above two seconds are conservatively skipped. It does not bypass login walls, CAPTCHAs, or render JavaScript. It does not search LinkedIn/Maps, replace Live Opportunities sources, or automatically discover an entire market from a keyword. Provide relevant directories/sites to seed discovery.

Run `node scripts/test-crawler.cjs` for isolated tests. Intended for one local app process.
