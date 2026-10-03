import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/forge-db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mint, creator, name, symbol, uri } = body ?? {};

  if (!mint || !creator || !name || !symbol || !uri) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { walletPubkey } = await createToken({ mint, creator, name, symbol, uri });
    return NextResponse.json({ walletPubkey });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
  }
}
