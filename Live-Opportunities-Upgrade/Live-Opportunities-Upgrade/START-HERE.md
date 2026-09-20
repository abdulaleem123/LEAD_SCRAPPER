# Live Opportunities upgrade

This adds an eight-source buying-request finder to your existing Sales OS app at `C:\leads_gen`.

The new feature includes service selection, fresh-post filters, evidence-based intent scoring, optional AI review, background monitoring, per-source health, saved/contacted/dismissed states, notes, desktop alerts and CSV export.

## Install

1. Stop the existing Sales OS development server.
2. Extract the complete ZIP into a folder.
3. Open PowerShell in that extracted folder and run `./Install-Live-Opportunities.ps1`.
4. Start Sales OS as usual. Open **Live Opportunities** in the top navigation.
5. Check **Search settings**, then click **Find opportunities**. Enable background monitoring when ready.

The installer adds the new feature and changes only the existing navigation file. It checks file hashes before installation and backs up the navigation. It will stop if it finds unexpected changes. It does not install packages, replace your environment file, modify the existing CRM database, or start paid scans.

The app reuses your existing Apify and AI connections. Scan charges depend on the providers. Some platforms may require paid access; source errors appear inside the app. Instagram uses hashtags/public accounts, not unrestricted text search. Private content and complete coverage of every social platform are not promised.

The source code passed a production build, TypeScript, lint of the new code, and 27 isolated behavioral checks. Live provider checks were performed; see `VALIDATION.md` for the observed results. No test databases, API keys, dependency folders, or sample leads are included.

Full operating notes are in `payload/OPPORTUNITIES.md` and will be installed into the app folder.
