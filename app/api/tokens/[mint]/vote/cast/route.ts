import { NextRequest, NextResponse } from "next/server";
import { getToken, getVoteState, hasVoted, castVote } from "@/lib/forge-db";
import { NUM_CARD_TYPES } from "@/lib/forge-program";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { slotIndex, cardId, voter } = await req.json();

  if (
    typeof slotIndex !== "number" ||
    typeof cardId !== "number" ||
    cardId < 0 ||
    cardId >= NUM_CARD_TYPES ||
    !voter
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const token = await getToken(mint);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vote = await getVoteState(mint, slotIndex);
  if (!vote || !vote.is_open) {
    return NextResponse.json({ error: "No open vote for this slot" }, { status: 400 });
  }
  if (cardId >= token.cards_unlocked) {
    return NextResponse.json({ error: "Card is not unlocked yet" }, { status: 400 });
  }
  if (token.card_equipped[cardId]) {
    return NextResponse.json({ error: "Card is already equipped elsewhere" }, { status: 400 });
  }
  if (await hasVoted(mint, slotIndex, voter)) {
    return NextResponse.json({ error: "Already voted" }, { status: 400 });
  }

  const newCounts = [...vote.vote_counts];
  newCounts[cardId] = (newCounts[cardId] ?? 0) + 1;

  await castVote(mint, slotIndex, voter, cardId, newCounts);
  return NextResponse.json({ ok: true });
}
