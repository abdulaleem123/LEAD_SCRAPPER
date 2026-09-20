"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  stats: {
    totalLeads: number;
    newLeads: number;
    qualified: number;
    excluded: number;
    withEmail: number;
    withLinkedin: number;
    icps: number;
    scrapeRuns: number;
  };
  recentLeads: Array<{
    id: string;
    fullName: string | null;
    companyName: string | null;
    title: string | null;
    email: string | null;
    status: string;
  }>;
  icps: Array<{ id: string; name: string; score: number | null; expert: string }>;
  runs: Array<{
    id: string;
    status: string;
    imported: number;
    excluded: number;
    requested: number;
    source: string;
  }>;
  config: {
    leadEngineReady: boolean;
    aiReady: boolean;
    provider: string;
  };
};

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-[var(--danger)]">{error}</p>;
  }

  if (!data) {
    return <p className="text-[var(--muted)]">Loading Sales OS…</p>;
  }

  const cards = [
    { label: "Total leads", value: data.stats.totalLeads },
    { label: "New", value: data.stats.newLeads },
    { label: "With email", value: data.stats.withEmail },
    { label: "With LinkedIn", value: data.stats.withLinkedin },
    { label: "Filtered (IT/tech)", value: data.stats.excluded },
    { label: "ICP profiles", value: data.stats.icps },
  ];

  return (
    <div className="space-y-8 fade-up">
      <section className="panel relative overflow-hidden rounded-[28px] p-8 md:p-10">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[rgba(15,122,78,0.12)] blur-2xl" />
        <div className="absolute bottom-0 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[rgba(196,92,38,0.12)] blur-2xl" />
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Lead generation system
        </p>
        <h1 className="display max-w-3xl text-4xl font-bold leading-[1.05] md:text-5xl">
          From zero leads to a qualified outreach pipeline.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Define your ideal client, find people who are actively asking for your
          services, scrape matching leads, and export clean CSVs for outreach.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/opportunities" className="btn btn-primary">
            Live Opportunities
          </Link>
          <Link href="/icp" className="btn btn-secondary">
            1 · Generate ICP
          </Link>
          <Link href="/scrape" className="btn btn-secondary">
            2 · Find leads
          </Link>
          <Link href="/leads" className="btn btn-secondary">
            3 · Manage leads
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className="panel rounded-3xl p-5 fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="text-sm text-[var(--muted)]">{c.label}</div>
            <div className="display mt-2 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-xl font-bold">System status</h2>
            <span className="chip">AI · {data.config.provider}</span>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 border border-[var(--line)]">
              <span>Lead engine</span>
              <span
                className={
                  data.config.leadEngineReady ? "chip chip-ok" : "chip chip-danger"
                }
              >
                {data.config.leadEngineReady ? "Ready" : "Not configured"}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 border border-[var(--line)]">
              <span>AI (ICP generator)</span>
              <span
                className={data.config.aiReady ? "chip chip-ok" : "chip chip-warn"}
              >
                {data.config.aiReady ? "Ready" : "Optional"}
              </span>
            </li>
          </ul>
        </div>

        <div className="panel rounded-3xl p-6">
          <h2 className="display mb-4 text-xl font-bold">Recent runs</h2>
          {data.runs.length === 0 ? (
            <p className="text-[var(--muted)]">No runs yet. Start from Find Leads.</p>
          ) : (
            <ul className="space-y-3">
              {data.runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-semibold capitalize">
                      {run.source.replace("_", " ")} · {run.status}
                    </div>
                    <div className="text-[var(--muted)]">
                      +{run.imported} imported · {run.excluded} filtered ·{" "}
                      {run.requested} requested
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="display text-xl font-bold">Fresh leads</h2>
          <Link href="/leads" className="btn btn-secondary">
            Open CRM
          </Link>
        </div>
        {data.recentLeads.length === 0 ? (
          <p className="text-[var(--muted)]">
            Empty pipeline. Generate an ICP, then run a 50-lead test search.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.fullName || "—"}</td>
                    <td>{lead.title || "—"}</td>
                    <td>{lead.companyName || "—"}</td>
                    <td>{lead.email || ""}</td>
                    <td>
                      <span className="chip">{lead.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
