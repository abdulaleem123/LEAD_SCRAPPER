"use client";

import { useEffect, useMemo, useState } from "react";

type Question = {
  id: string;
  label: string;
  placeholder?: string;
  options?: string[];
};

type Expert = {
  id: "alex_berman" | "patrick_dang" | "eric_novoselov";
  name: string;
  tagline: string;
  description: string;
  questions: Question[];
};

type Icp = {
  id: string;
  name: string;
  expert: string;
  provider: string;
  score: number | null;
  profile: Record<string, unknown>;
  searchTerms: Record<string, unknown>;
  answers: Record<string, string>;
  createdAt: string;
};

export default function IcpPage() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [icps, setIcps] = useState<Icp[]>([]);
  const [expertId, setExpertId] = useState<Expert["id"]>("alex_berman");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "lmstudio">(
    "openai",
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Icp | null>(null);

  const expert = useMemo(
    () => experts.find((e) => e.id === expertId) || experts[0],
    [experts, expertId],
  );

  async function load() {
    const res = await fetch("/api/icp");
    const data = await res.json();
    setExperts(data.experts || []);
    setIcps(data.icps || []);
    if (data.defaultProvider) setProvider(data.defaultProvider);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!expert) return;
    setAnswers((prev) => {
      const next: Record<string, string> = {};
      for (const q of expert.questions) next[q.id] = prev[q.id] || "";
      return next;
    });
  }, [expert]);

  function applyBulk() {
    if (!expert) return;
    const lines = bulkText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const next = { ...answers };
    expert.questions.forEach((q, i) => {
      if (lines[i]) next[q.id] = lines[i];
    });
    // Also support key: value
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
      if (m && next[m[1]] !== undefined) next[m[1]] = m[2];
    }
    setAnswers(next);
    setBulkMode(false);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expert: expertId,
          provider,
          answers,
          offline: provider === "lmstudio" ? false : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setActive(data.icp);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/icp/${id}`, { method: "DELETE" });
    if (active?.id === id) setActive(null);
    await load();
  }

  const profile = active?.profile as {
    summary?: string;
    goldenGoose?: string;
    coaching?: string;
    titles?: string[];
    excludeTitles?: string[];
    industries?: string[];
    triggers?: string[];
    noBrainerOffer?: string;
    easeOfContact?: string;
    pivots?: string[];
  } | null;

  const searchTerms = active?.searchTerms as {
    apollo?: Record<string, unknown>;
    linkedin?: Record<string, unknown>;
    apify?: Record<string, unknown>;
    jobKeywords?: string[];
  } | null;

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="display text-4xl font-bold">ICP Generator</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Same Day-1 move from the video: define who you sell to with expert frameworks
          (Alex Berman · Patrick Dang · Eric Novoselov), then convert into Apollo /
          Apollo / LinkedIn search cards — including IT/tech excludes.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel rounded-[10px] p-6 space-y-5 fade-up transition-shadow duration-300 hover:shadow-lg">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Expert framework</label>
              <select
                className="field transition-shadow duration-200 focus:shadow-md"
                value={expertId}
                onChange={(e) => setExpertId(e.target.value as Expert["id"])}
              >
                {experts.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.tagline}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">AI model provider</label>
              <select
                className="field transition-shadow duration-200 focus:shadow-md"
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as typeof provider)
                }
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="lmstudio">LM Studio / local</option>
              </select>
            </div>
          </div>

          {expert && (
            <p className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)] fade-up">
              {expert.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
              onClick={() => setBulkMode((v) => !v)}
            >
              {bulkMode ? "Question mode" : "Paste all answers at once"}
            </button>
          </div>

          {bulkMode ? (
            <div className="fade-up">
              <label className="label">One answer per line (or key: value)</label>
              <textarea
                className="field min-h-48 rounded-[10px] transition-shadow duration-200 focus:shadow-md"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={expert?.questions.map((q) => q.label).join("\n")}
              />
              <button
                type="button"
                className="btn btn-secondary mt-3 transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
                onClick={applyBulk}
              >
                Apply answers
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {expert?.questions.map((q, i) => (
                <div
                  key={q.id}
                  className="fade-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <label className="label">{q.label}</label>
                  {q.options ? (
                    <select
                      className="field rounded-[10px] transition-shadow duration-200 focus:shadow-md"
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                    >
                      <option value="">Select…</option>
                      {q.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field rounded-[10px] transition-shadow duration-200 focus:shadow-md"
                      value={answers[q.id] || ""}
                      placeholder={q.placeholder}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-[10px] bg-[#fff1f2] px-4 py-3 text-sm text-[var(--danger)] fade-up">
              {error}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
            disabled={loading}
            onClick={generate}
          >
            {loading ? "Generating ICP…" : "Generate ICP + search terms"}
          </button>
        </section>

        <aside className="space-y-5">
          <div className="panel rounded-[10px] p-6 fade-up transition-shadow duration-300 hover:shadow-lg">
            <h2 className="display text-xl font-bold">Saved ICPs</h2>
            <ul className="mt-4 space-y-2">
              {icps.length === 0 && (
                <li className="text-sm text-[var(--muted)]">None yet.</li>
              )}
              {icps.map((icp, i) => (
                <li
                  key={icp.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 fade-up transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setActive(icp)}
                  >
                    <div className="font-semibold">{icp.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      score {icp.score ?? "—"} · {icp.expert}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger !px-3 !py-1.5 text-xs transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
                    onClick={() => remove(icp.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {active && profile && (
            <div className="panel rounded-[10px] p-6 space-y-4 fade-up">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="display text-2xl font-bold">{active.name}</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Saved · ready for scrape campaigns
                  </p>
                </div>
                <span
                  className={`chip transition-transform duration-200 hover:scale-105 ${
                    (active.score || 0) >= 80 ? "chip-ok" : "chip-warn"
                  }`}
                >
                  Score {active.score ?? "—"}/100
                </span>
              </div>
              <p>{profile.summary}</p>
              <div className="rounded-[10px] bg-[#ecfdf5] px-4 py-3 text-sm">
                <strong>Golden goose:</strong> {profile.goldenGoose}
              </div>
              <div className="grid gap-3 text-sm">
                <div>
                  <div className="label">Titles</div>
                  <div className="flex flex-wrap gap-1">
                    {(profile.titles || []).map((t) => (
                      <span
                        key={t}
                        className="chip rounded-[10px] transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label">Exclude titles (IT/tech)</div>
                  <div className="flex flex-wrap gap-1">
                    {(profile.excludeTitles || []).slice(0, 12).map((t) => (
                      <span
                        key={t}
                        className="chip chip-danger rounded-[10px] transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label">Triggers</div>
                  <p className="text-[var(--muted)]">
                    {(profile.triggers || []).join(" · ")}
                  </p>
                </div>
                <div>
                  <div className="label">No-brainer offer</div>
                  <p>{profile.noBrainerOffer}</p>
                </div>
              </div>
              <details className="rounded-[10px] border border-[var(--line)] bg-white p-4 transition-shadow duration-200 hover:shadow-md">
                <summary className="cursor-pointer font-semibold">
                  Search filters (JSON)
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto text-xs leading-relaxed">
                  {JSON.stringify(searchTerms, null, 2)}
                </pre>
              </details>
              <p className="text-sm text-[var(--muted)]">{profile.coaching}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
