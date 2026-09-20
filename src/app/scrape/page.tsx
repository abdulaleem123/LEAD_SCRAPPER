"use client";

import { useEffect, useState } from "react";

type Icp = {
  id: string;
  name: string;
  score: number | null;
  searchTerms: {
    apify?: { searchQueries?: string[] };
    linkedin?: { locations?: string[] };
  };
};

type Run = {
  id: string;
  status: string;
  source: string;
  requested: number;
  imported: number;
  excluded: number;
  error: string | null;
  createdAt: string;
};

export default function ScrapePage() {
  const [icps, setIcps] = useState<Icp[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [icpId, setIcpId] = useState("");
  const [source, setSource] = useState<"linkedin" | "google_maps">("linkedin");
  const [maxItems, setMaxItems] = useState(50);
  const [findEmails, setFindEmails] = useState(true);
  const [mapsQuery, setMapsQuery] = useState("");
  const [mapsLocation, setMapsLocation] = useState("United States");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [icpRes, runRes] = await Promise.all([
      fetch("/api/icp"),
      fetch("/api/scrape"),
    ]);
    const icpData = await icpRes.json();
    const runData = await runRes.json();
    setIcps(icpData.icps || []);
    setRuns(runData.runs || []);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  const selected = icps.find((i) => i.id === icpId);

  async function runScrape() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icpId: icpId || null,
          source,
          maxItems,
          findEmails: source === "linkedin" ? findEmails : false,
          mapsQuery: mapsQuery || undefined,
          mapsLocation: mapsLocation || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lead search failed");
      setMessage(
        `Done. Found ${data.totalFetched} profiles · ${data.imported} new leads · ${data.excluded} filtered out${data.withEmail != null ? ` · ${data.withEmail} with email` : ""}.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="display text-4xl font-bold">Find Leads</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Pull decision-makers from LinkedIn or local businesses from Google Maps.
          Start with 50, then scale to thousands. Emails show when found — otherwise
          left blank.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel rounded-3xl p-6 space-y-4">
          <div>
            <label className="label">ICP campaign</label>
            <select
              className="field"
              value={icpId}
              onChange={(e) => setIcpId(e.target.value)}
            >
              <option value="">No ICP (broader search)</option>
              {icps.map((icp) => (
                <option key={icp.id} value={icp.id}>
                  {icp.name} {icp.score != null ? `(${icp.score})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Source</label>
              <select
                className="field"
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as "linkedin" | "google_maps")
                }
              >
                <option value="linkedin">LinkedIn decision-makers</option>
                <option value="google_maps">Google Maps · local businesses</option>
              </select>
            </div>
            <div>
              <label className="label">How many leads?</label>
              <input
                className="field"
                type="number"
                min={1}
                max={2500}
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value) || 1)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[50, 100, 250, 500, 1000, 2500].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    onClick={() => setMaxItems(n)}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {source === "linkedin" && (
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={findEmails}
                onChange={(e) => setFindEmails(e.target.checked)}
              />
              <span>
                <strong>Find emails</strong> — when available, email is saved on the
                lead. If not found, the field stays blank.
              </span>
            </label>
          )}

          {source === "google_maps" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Business type</label>
                <input
                  className="field"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder="law firm, dental clinic, real estate agency"
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  className="field"
                  value={mapsLocation}
                  onChange={(e) => setMapsLocation(e.target.value)}
                  placeholder="United States"
                />
              </div>
            </div>
          )}

          {selected?.searchTerms?.apify?.searchQueries && (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-4 text-sm">
              <div className="label">Search angles from your ICP</div>
              <ul className="list-disc pl-5 text-[var(--muted)]">
                {selected.searchTerms.apify.searchQueries.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-[#fff1f2] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-2xl bg-[#ecfdf5] px-4 py-3 text-sm text-[var(--ok)]">
              {message}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={runScrape}
          >
            {loading ? "Finding leads…" : "Start lead search"}
          </button>
        </section>

        <aside className="space-y-5">
          <div className="panel rounded-3xl p-6">
            <h2 className="display text-xl font-bold">Tips for scale</h2>
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <li>Run 50 first to check lead quality.</li>
              <li>Scale to 500–2,500 once your ICP filters look right.</li>
              <li>Enable <strong>Find emails</strong> for outreach-ready lists.</li>
              <li>Use Google Maps for local businesses with phone + website.</li>
              <li>Export from Lead CRM when ready.</li>
            </ul>
          </div>

          <div className="panel rounded-3xl p-6">
            <h2 className="display text-xl font-bold">Run log</h2>
            <ul className="mt-4 space-y-2">
              {runs.length === 0 && (
                <li className="text-sm text-[var(--muted)]">No runs yet.</li>
              )}
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-sm"
                >
                  <div className="font-semibold capitalize">
                    {run.source.replace("_", " ")} · {run.status}
                  </div>
                  <div className="text-[var(--muted)]">
                    {run.imported} new · {run.excluded} filtered · {run.requested}{" "}
                    requested
                  </div>
                  {run.error && (
                    <div className="mt-1 text-[var(--danger)]">{run.error}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
