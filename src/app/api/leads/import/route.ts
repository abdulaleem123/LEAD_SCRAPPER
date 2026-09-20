import { NextResponse } from "next/server";
import { upsertLead } from "@/lib/db";
import { applyIcpFilter } from "@/lib/apify";
import { getIcp } from "@/lib/db";

export const runtime = "nodejs";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some(Boolean)).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] || "").trim();
    });
    return obj;
  });
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const found = Object.entries(row).find(
      ([k]) => k.toLowerCase() === key.toLowerCase(),
    );
    if (found?.[1]) return found[1];
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const icpId = String(form.get("icpId") || "") || null;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file required" }, { status: 400 });
    }
    const text = await file.text();
    const rows = parseCsv(text);
    const icp = icpId ? getIcp(icpId) : null;

    let imported = 0;
    let excluded = 0;
    let skipped = 0;

    for (const row of rows) {
      const fullName =
        pick(row, ["Name", "Full Name", "fullName"]) ||
        [pick(row, ["First Name", "firstName"]), pick(row, ["Last Name", "lastName"])]
          .filter(Boolean)
          .join(" ") ||
        null;
      const normalized = {
        source: "apollo_export" as const,
        fullName,
        firstName: pick(row, ["First Name", "firstName"]),
        lastName: pick(row, ["Last Name", "lastName"]),
        title: pick(row, ["Title", "Job Title", "title"]),
        email: pick(row, ["Email", "Work Email", "email"]),
        phone: pick(row, ["Phone", "Mobile Phone", "phone"]),
        linkedinUrl: pick(row, ["Person Linkedin Url", "LinkedIn URL", "linkedinUrl"]),
        companyName: pick(row, ["Company", "Company Name", "Organization", "companyName"]),
        companyWebsite: pick(row, ["Website", "Company Website", "companyWebsite"]),
        companyLinkedin: pick(row, ["Company Linkedin Url"]),
        companySize: pick(row, ["# Employees", "Employees", "companySize"]),
        industry: pick(row, ["Industry", "industry"]),
        location: pick(row, ["Location", "City", "Person City", "location"]),
        address: null,
        rawJson: JSON.stringify(row),
      };

      const filtered = applyIcpFilter(normalized, icp?.profile, icp?.searchTerms);
      const { inserted } = upsertLead({
        ...filtered,
        icpId,
        scrapeRunId: null,
      });
      if (filtered.status === "excluded") excluded += 1;
      else if (inserted) imported += 1;
      else skipped += 1;
    }

    return NextResponse.json({
      total: rows.length,
      imported,
      excluded,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
