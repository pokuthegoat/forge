import { NextRequest, NextResponse } from "next/server";
import { getToken, getVoteState, startVote } from "@/lib/forge-db";
import { EMPTY_SLOT, NUM_SLOTS } from "@/lib/forge-program";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const { slotIndex } = await req.json();

  if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= NUM_SLOTS) {
    return NextResponse.json({ error: "Invalid slot index" }, { status: 400 });
  }

  const token = await getToken(mint);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (token.slots[slotIndex] !== EMPTY_SLOT) {
    return NextResponse.json({ error: "Slot already filled" }, { status: 400 });
  }

  const hasCandidate = Array.from({ length: token.cards_unlocked }).some(
    (_, cardId) => !token.card_equipped[cardId]
  );
  if (!hasCandidate) {
    return NextResponse.json({ error: "No unlocked card available to vote on" }, { status: 400 });
  }

  const existing = await getVoteState(mint, slotIndex);
  if (existing) {
    return NextResponse.json({ error: "Vote already started for this slot" }, { status: 400 });
  }

  await startVote(mint, slotIndex);
  return NextResponse.json({ ok: true });
}
