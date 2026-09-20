"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  fullName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  industry: string | null;
  location: string | null;
  status: string;
  excludeReason: string | null;
  source: string;
  rawJson: string | null;
};

function evidenceUrl(lead: Lead) {
  try { const url = JSON.parse(lead.rawJson || '{}').sourceUrl; return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null; } catch { return null; }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasLinkedin, setHasLinkedin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    fullName: "",
    title: "",
    email: "",
    companyName: "",
    linkedinUrl: "",
  });

  async function load() {
    const params = new URLSearchParams({
      q,
      status,
      source,
      hasEmail: hasEmail ? "1" : "0",
      hasLinkedin: hasLinkedin ? "1" : "0",
    });
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    setLeads(data.leads || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setLeadStatus(id: string, next: string) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: next,
        excludeReason: next === "excluded" ? "Manual exclude" : null,
      }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function addManual() {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manual),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    setManualOpen(false);
    setManual({
      fullName: "",
      title: "",
      email: "",
      companyName: "",
      linkedinUrl: "",
    });
    await load();
  }

  const exportHref = `/api/leads/export?${new URLSearchParams({
    q,
    status,
    source,
    hasEmail: hasEmail ? "1" : "0",
    hasLinkedin: hasLinkedin ? "1" : "0",
  })}`;

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-bold">Lead CRM</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Confirm, qualify, exclude, and export. Deduped automatically by email /
            LinkedIn / name+company.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-secondary cursor-pointer">
            Import Apollo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportMsg(null);
                const fd = new FormData();
                fd.append("file", file);
                const res = await fetch("/api/leads/import", {
                  method: "POST",
                  body: fd,
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(data.error || "Import failed");
                  return;
                }
                setImportMsg(
                  `Imported ${data.imported} · excluded ${data.excluded} · skipped dupes ${data.skipped}`,
                );
                await load();
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setManualOpen((v) => !v)}
          >
            Insert lead
          </button>
          <a className="btn btn-primary" href={exportHref}>
            Export CSV
          </a>
        </div>
      </div>

      <section className="panel rounded-3xl p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="label">Search</label>
            <input
              className="field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, company, email, title…"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {[
                "all",
                "new",
                "qualified",
                "excluded",
                "contacted",
                "replied",
                "archived",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Source</label>
            <select
              className="field"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {["all", "web", "linkedin", "google_maps", "manual", "apollo_export"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="button" className="btn btn-primary w-full" onClick={() => load()}>
              Filter
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasEmail}
              onChange={(e) => setHasEmail(e.target.checked)}
            />
            Has email
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasLinkedin}
              onChange={(e) => setHasLinkedin(e.target.checked)}
            />
            Has LinkedIn
          </label>
        </div>
      </section>

      {manualOpen && (
        <section className="panel rounded-3xl p-5 space-y-3">
          <h2 className="display text-xl font-bold">Insert lead</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["fullName", "Full name"],
                ["title", "Title"],
                ["email", "Email"],
                ["companyName", "Company"],
                ["linkedinUrl", "LinkedIn URL"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="field"
                  value={manual[key]}
                  onChange={(e) =>
                    setManual((m) => ({ ...m, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => addManual()}>
            Save lead
          </button>
        </section>
      )}

      {importMsg && (
        <p className="rounded-2xl bg-[#ecfdf5] px-4 py-3 text-sm text-[var(--ok)]">
          {importMsg}
        </p>
      )}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Reach</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  No leads match these filters.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div className="font-semibold">{lead.fullName || "—"}</div>
                  <div className="text-xs text-[var(--muted)]">{lead.title || "—"}</div>
                  <div className="text-xs text-[var(--muted)] capitalize">
                    {lead.source.replace("_", " ")}
                  </div>
                </td>
                <td>
                  <div>{lead.companyName || "—"}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {lead.industry || "—"}
                    {lead.location ? ` · ${lead.location}` : ""}
                  </div>
                  {lead.companyWebsite && (
                    <a
                      className="text-xs text-[var(--accent)]"
                      href={lead.companyWebsite}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website
                    </a>
                  )}
                </td>
                <td>
                  <div className="text-sm">{lead.email || ""}</div>
                  <div className="text-xs text-[var(--muted)]">{lead.phone || ""}</div>
                  {lead.excludeReason && (
                    <div className="mt-1 text-xs text-[var(--danger)]">
                      {lead.excludeReason}
                    </div>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.linkedinUrl ? (
                      <a
                        className="btn btn-secondary !px-2.5 !py-1 text-xs"
                        href={lead.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        LinkedIn
                      </a>
                    ) : (
                      <span className="chip text-[var(--muted)]">No LinkedIn</span>
                    )}
                    {lead.email ? (
                      <a
                        className="btn btn-secondary !px-2.5 !py-1 text-xs"
                        href={`mailto:${lead.email}`}
                      >
                        Email
                      </a>
                    ) : null}
                    {lead.source === 'web' && evidenceUrl(lead) && <a className="btn btn-secondary !px-2.5 !py-1 text-xs" href={evidenceUrl(lead)!} target="_blank" rel="noreferrer">Contact source</a>}
                    {lead.companyWebsite ? (
                      <a
                        className="btn btn-secondary !px-2.5 !py-1 text-xs"
                        href={
                          lead.companyWebsite.startsWith("http")
                            ? lead.companyWebsite
                            : `https://${lead.companyWebsite}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Website
                      </a>
                    ) : null}
                    {lead.phone ? (
                      <a
                        className="btn btn-secondary !px-2.5 !py-1 text-xs"
                        href={`tel:${lead.phone.replace(/\s/g, "")}`}
                      >
                        Call
                      </a>
                    ) : null}
                  </div>
                </td>
                <td>
                  <select
                    className="field !py-2"
                    value={lead.status}
                    onChange={(e) => setLeadStatus(lead.id, e.target.value)}
                  >
                    {[
                      "new",
                      "qualified",
                      "excluded",
                      "contacted",
                      "replied",
                      "archived",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger !px-3 !py-1.5 text-xs"
                    onClick={() => remove(lead.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
