import { NextRequest, NextResponse } from "next/server";
import { issueChallenge, isAdminWallet } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { wallet } = await req.json();
  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  if (!isAdminWallet(wallet)) {
    return NextResponse.json({ error: "Not an admin wallet" }, { status: 403 });
  }
  const message = await issueChallenge(wallet);
  return NextResponse.json({ message });
}
