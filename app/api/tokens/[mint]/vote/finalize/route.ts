import { NextRequest, NextResponse } from "next/server";
import { getToken, getVoteState, closeVote, updateTokenState } from "@/lib/forge-db";
import { pickVoteWinner } from "@/lib/forge-engine";
import { VOTE_WINDOW_SECS } from "@/lib/forge-program";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { slotIndex } = await req.json();

  const token = await getToken(mint);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vote = await getVoteState(mint, slotIndex);
  if (!vote || !vote.is_open) {
    return NextResponse.json({ error: "No open vote for this slot" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < vote.start_ts + VOTE_WINDOW_SECS) {
    return NextResponse.json({ error: "Voting window has not closed yet" }, { status: 400 });
  }

  const winner = pickVoteWinner(token, vote.vote_counts);
  if (winner === null) {
    return NextResponse.json({ error: "No eligible card to equip" }, { status: 400 });
  }

  const slots = [...token.slots];
  slots[slotIndex] = winner;
  const cardEquipped = [...token.card_equipped];
  cardEquipped[winner] = true;

  await updateTokenState(mint, { slots, card_equipped: cardEquipped });
  await closeVote(mint, slotIndex);

  return NextResponse.json({ ok: true, winner });
}
