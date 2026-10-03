import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/forge-db";
import { syncFees, checkUnlock } from "@/lib/forge-engine";
import { executeBuyback, executeBurn, executeLp } from "@/lib/card-execution";
import { getServerConnection } from "@/lib/connection";
import { CARD_BUYBACK, CARD_BURN, CARD_LP } from "@/lib/forge-program";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const connection = getServerConnection();

  let token = await getToken(mint);
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    token = await syncFees(connection, token);
    const unlockResult = await checkUnlock(token);
    token = unlockResult.token;

    if (token.slots.includes(CARD_BUYBACK) && BigInt(token.card_pools[CARD_BUYBACK]) > 0n) {
      await executeBuyback(connection, token);
      token = await getToken(mint);
    }
    if (token && token.slots.includes(CARD_BURN) && BigInt(token.card_pools[CARD_BURN]) > 0n) {
      await executeBurn(connection, token);
      token = await getToken(mint);
    }
    if (token && token.slots.includes(CARD_LP) && BigInt(token.card_pools[CARD_LP]) > 0n) {
      await executeLp(connection, token);
      token = await getToken(mint);
    }
  } catch (err) {
    console.error("Background sync failed:", err);
  }

  const { wallet_privkey_enc: _unused, ...publicToken } = token!;
  void _unused;
  return NextResponse.json(publicToken);
}
