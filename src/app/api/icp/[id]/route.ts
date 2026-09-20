import { NextResponse } from "next/server";
import { deleteIcp, getIcp } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const icp = getIcp(id);
  if (!icp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ icp });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  deleteIcp(id);
  return NextResponse.json({ ok: true });
}
