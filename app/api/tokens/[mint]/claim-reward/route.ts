import { NextRequest, NextResponse } from "next/server";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getToken, updateTokenState } from "@/lib/forge-db";
import { calculateRewardPayout } from "@/lib/forge-engine";
import { loadTokenKeypair } from "@/lib/wallet-custody";
import { getServerConnection } from "@/lib/connection";
import { CARD_REWARD } from "@/lib/forge-program";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { holder } = await req.json();
  if (!holder) return NextResponse.json({ error: "Missing holder" }, { status: 400 });

  const token = await getToken(mint);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const connection = getServerConnection();
  const holderPubkey = new PublicKey(holder);

  const payout = await calculateRewardPayout(connection, token, holderPubkey);
  if (payout <= 0n) {
    return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
  }

  const keypair = loadTokenKeypair(token.wallet_privkey_enc);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: holderPubkey,
      lamports: Number(payout),
    })
  );
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  const cardPools = token.card_pools.map((p) => BigInt(p));
  cardPools[CARD_REWARD] -= payout;
  await updateTokenState(mint, { card_pools: cardPools.map((p) => p.toString()) });

  return NextResponse.json({ ok: true, payoutLamports: payout.toString(), signature: sig });
}
