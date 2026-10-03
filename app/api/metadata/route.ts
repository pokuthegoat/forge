import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, ensureSchema } from "@/lib/db";

const MAX_IMAGE_BYTES = 2_000_000;

export async function POST(req: NextRequest) {
  const { name, symbol, description, imageDataUri } = await req.json();

  if (!name || !symbol || !imageDataUri) {
    return NextResponse.json({ error: "Missing name, symbol, or image" }, { status: 400 });
  }
  if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(imageDataUri)) {
    return NextResponse.json({ error: "Image must be a PNG, JPEG, GIF, or WebP file" }, { status: 400 });
  }
  if (imageDataUri.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max ~1.5MB)" }, { status: 400 });
  }

  await ensureSchema();
  const id = randomUUID();
  const json = JSON.stringify({
    name,
    symbol,
    description: description ?? "",
    image: imageDataUri,
  });

  await db.execute({
    sql: "INSERT INTO token_metadata (id, json, created_at) VALUES (?, ?, ?)",
    args: [id, json, Date.now()],
  });

  const uri = `${req.nextUrl.origin}/api/metadata/${id}`;
  return NextResponse.json({ uri });
}
