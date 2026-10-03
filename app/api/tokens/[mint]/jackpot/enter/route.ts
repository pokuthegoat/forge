import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { getToken, hasEnteredJackpot, enterJackpot } from "@/lib/forge-db";
import { getServerConnection } from "@/lib/connection";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { wallet } = await req.json();
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  const token = await getToken(mint);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const connection = getServerConnection();
  let walletPubkey: PublicKey;
  let mintPubkey: PublicKey;
  try {
    walletPubkey = new PublicKey(wallet);
    mintPubkey = new PublicKey(mint);
  } catch {
    return NextResponse.json({ error: "Invalid wallet or mint address" }, { status: 400 });
  }
  const ata = getAssociatedTokenAddressSync(mintPubkey, walletPubkey);

  let balance = 0n;
  try {
    balance = (await getAccount(connection, ata)).amount;
  } catch {
    balance = 0n;
  }
  if (balance <= 0n) {
    return NextResponse.json({ error: "Wallet does not hold any of this token" }, { status: 400 });
  }

  if (await hasEnteredJackpot(mint, token.jackpot_round, wallet)) {
    return NextResponse.json({ error: "Already entered this round" }, { status: 400 });
  }

  await enterJackpot(mint, token.jackpot_round, wallet);
  return NextResponse.json({ ok: true });
}
