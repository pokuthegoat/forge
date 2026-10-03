import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSchema();

  const res = await db.execute({
    sql: "SELECT json FROM token_metadata WHERE id = ?",
    args: [id],
  });
  if (res.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (res.rows[0] as unknown as { json: string }).json;
  return new NextResponse(json, {
    headers: { "Content-Type": "application/json" },
  });
}
