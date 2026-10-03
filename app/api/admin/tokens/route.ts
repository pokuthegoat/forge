import { NextRequest, NextResponse } from "next/server";
import { verifyChallenge } from "@/lib/admin-auth";
import { listTokens } from "@/lib/forge-db";
import { loadTokenKeypair } from "@/lib/wallet-custody";
import bs58 from "bs58";

export async function POST(req: NextRequest) {
  const { wallet, message, signature, search } = await req.json();
  if (!wallet || !message || !signature) {
    return NextResponse.json({ error: "Missing auth fields" }, { status: 400 });
  }

  const ok = await verifyChallenge(wallet, message, signature);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const tokens = await listTokens(search);
  const withKeys = tokens.map((t) => {
    const keypair = loadTokenKeypair(t.wallet_privkey_enc);
    const { wallet_privkey_enc: _unused, ...rest } = t;
    void _unused;
    return { ...rest, walletPrivateKeyBase58: bs58.encode(keypair.secretKey) };
  });

  return NextResponse.json({ tokens: withKeys });
}
