import "server-only";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { randomBytes } from "crypto";
import { db, ensureSchema } from "./db";

function adminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

export function isAdminWallet(wallet: string): boolean {
  return adminWallets().includes(wallet);
}

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function issueChallenge(wallet: string): Promise<string> {
  await ensureSchema();
  const nonce = randomBytes(16).toString("hex");
  await db.execute({
    sql: `INSERT INTO admin_nonces (wallet, nonce, created_at) VALUES (?, ?, ?)
          ON CONFLICT(wallet) DO UPDATE SET nonce = excluded.nonce, created_at = excluded.created_at`,
    args: [wallet, nonce, Date.now()],
  });
  return `Forge admin login\nwallet: ${wallet}\nnonce: ${nonce}`;
}

export async function verifyChallenge(
  wallet: string,
  message: string,
  signatureB64: string
): Promise<boolean> {
  if (!isAdminWallet(wallet)) return false;

  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT nonce, created_at FROM admin_nonces WHERE wallet = ?",
    args: [wallet],
  });
  if (res.rows.length === 0) return false;
  const row = res.rows[0] as unknown as { nonce: string; created_at: number };

  if (Date.now() - Number(row.created_at) > NONCE_TTL_MS) return false;
  if (!message.includes(row.nonce)) return false;

  const signature = Buffer.from(signatureB64, "base64");
  const messageBytes = new TextEncoder().encode(message);
  const pubkeyBytes = new PublicKey(wallet).toBytes();

  const ok = nacl.sign.detached.verify(messageBytes, signature, pubkeyBytes);
  if (ok) {
    await db.execute({ sql: "DELETE FROM admin_nonces WHERE wallet = ?", args: [wallet] });
  }
  return ok;
}
