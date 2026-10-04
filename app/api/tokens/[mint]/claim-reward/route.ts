import { NextRequest, NextResponse } from "next/server";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getToken, claimRewardIfUnchanged } from "@/lib/forge-db";
import { calculateRewardPayout } from "@/lib/forge-engine";
import { loadTokenKeypair } from "@/lib/wallet-custody";
import { getServerConnection } from "@/lib/connection";
import { confirmOrThrow } from "@/lib/solana-tx";

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

  const { payout, alreadyClaimed } = await calculateRewardPayout(connection, token, holderPubkey);
  if (payout <= 0n) {
    return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
  }

  // Reserve this claim atomically before paying out, so a double-click or
  // two near-simultaneous requests can't both claim the same entitlement.
  const newClaimed = (BigInt(alreadyClaimed) + payout).toString();
  const reserved = await claimRewardIfUnchanged(mint, holder, alreadyClaimed, newClaimed);
  if (!reserved) {
    return NextResponse.json(
      { error: "Claim is already in progress, try again" },
      { status: 409 }
    );
  }

  const keypair = loadTokenKeypair(token.wallet_privkey_enc);

  try {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: holderPubkey,
        lamports: Number(payout),
      })
    );
    tx.feePayer = keypair.publicKey;
    const blockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;
    tx.sign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await confirmOrThrow(connection, sig, blockhash);

    return NextResponse.json({ ok: true, payoutLamports: payout.toString(), signature: sig });
  } catch (err) {
    // The payout didn't actually go through but we already reserved the
    // claim - put it back so the holder isn't locked out of their own
    // entitlement, then let this request fail as before.
    await claimRewardIfUnchanged(mint, holder, newClaimed, alreadyClaimed);
    throw err;
  }
}
