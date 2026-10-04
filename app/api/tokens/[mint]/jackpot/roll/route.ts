import { NextRequest, NextResponse } from "next/server";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { getToken, listJackpotEntrants, updateTokenState } from "@/lib/forge-db";
import { loadTokenKeypair } from "@/lib/wallet-custody";
import { getServerConnection } from "@/lib/connection";
import { CARD_JACKPOT } from "@/lib/forge-program";
import { confirmOrThrow } from "@/lib/solana-tx";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { message, signature } = await req.json();
  if (!message || !signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const token = await getToken(mint);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const timestampMatch = message.match(/timestamp:\s*(\d+)/);
  const timestamp = timestampMatch ? Number(timestampMatch[1]) : 0;
  if (!message.includes(mint) || Math.abs(Date.now() - timestamp) > 2 * 60 * 1000) {
    return NextResponse.json({ error: "Stale or invalid message" }, { status: 400 });
  }

  const ok = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    Buffer.from(signature, "base64"),
    new PublicKey(token.creator).toBytes()
  );
  if (!ok) {
    return NextResponse.json({ error: "Signature does not match creator" }, { status: 403 });
  }

  const entrants = await listJackpotEntrants(mint, token.jackpot_round);
  if (entrants.length === 0) {
    return NextResponse.json({ error: "No entrants this round" }, { status: 400 });
  }

  const payout = BigInt(token.card_pools[CARD_JACKPOT]);
  if (payout <= 0n) {
    return NextResponse.json({ error: "Jackpot pool is empty" }, { status: 400 });
  }

  const seed = Date.now() ^ token.jackpot_round;
  const winner = entrants[seed % entrants.length];

  const keypair = loadTokenKeypair(token.wallet_privkey_enc);
  const connection = getServerConnection();
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: new PublicKey(winner),
      lamports: Number(payout),
    })
  );
  tx.feePayer = keypair.publicKey;
  const blockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;
  tx.sign(keypair);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await confirmOrThrow(connection, sig, blockhash);

  const cardPools = token.card_pools.map((p) => BigInt(p));
  cardPools[CARD_JACKPOT] = 0n;
  await updateTokenState(mint, {
    card_pools: cardPools.map((p) => p.toString()),
    jackpot_round: token.jackpot_round + 1,
  });

  return NextResponse.json({ ok: true, winner, signature: sig });
}
