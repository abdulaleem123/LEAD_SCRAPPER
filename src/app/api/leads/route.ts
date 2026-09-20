import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteLead, listLeads, updateLeadStatus, upsertLead } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leads = listLeads({
    q: searchParams.get("q") || undefined,
    status: (searchParams.get("status") as "all") || "all",
    source: (searchParams.get("source") as "all") || "all",
    icpId: searchParams.get("icpId") || "all",
    hasEmail: searchParams.get("hasEmail") === "1",
    hasLinkedin: searchParams.get("hasLinkedin") === "1",
  });
  return NextResponse.json({ leads });
}

const PatchSchema = z.object({
  id: z.string(),
  status: z.enum([
    "new",
    "qualified",
    "excluded",
    "contacted",
    "replied",
    "archived",
  ]),
  excludeReason: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const body = PatchSchema.parse(await req.json());
  const lead = updateLeadStatus(body.id, body.status, body.excludeReason);
  return NextResponse.json({ lead });
}

const ManualSchema = z.object({
  fullName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  icpId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const body = ManualSchema.parse(await req.json());
  const { lead } = upsertLead({
    icpId: body.icpId ?? null,
    scrapeRunId: null,
    source: "manual",
    fullName: body.fullName ?? null,
    firstName: null,
    lastName: null,
    title: body.title ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    linkedinUrl: body.linkedinUrl ?? null,
    companyName: body.companyName ?? null,
    companyWebsite: body.companyWebsite ?? null,
    companyLinkedin: null,
    companySize: null,
    industry: body.industry ?? null,
    location: body.location ?? null,
    address: null,
    status: "new",
    excludeReason: null,
    rawJson: null,
  });
  return NextResponse.json({ lead });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  deleteLead(id);
  return NextResponse.json({ ok: true });
}
