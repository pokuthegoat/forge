import "server-only";
import { db, ensureSchema } from "./db";
import { generateTokenWallet } from "./wallet-custody";
import {
  NUM_CARD_TYPES,
  NUM_SLOTS,
  EMPTY_SLOT,
  type TokenState,
  type VoteStateRow,
} from "./forge-program";

export interface TokenRow extends TokenState {
  wallet_privkey_enc: string;
}

function parseTokenRow(row: Record<string, unknown>): TokenRow {
  return {
    mint: row.mint as string,
    creator: row.creator as string,
    name: row.name as string,
    symbol: row.symbol as string,
    uri: row.uri as string,
    wallet_pubkey: row.wallet_pubkey as string,
    wallet_privkey_enc: row.wallet_privkey_enc as string,
    total_fees_received: row.total_fees_received as string,
    total_withdrawn: row.total_withdrawn as string,
    cards_unlocked: Number(row.cards_unlocked),
    slots: JSON.parse(row.slots as string),
    card_equipped: JSON.parse(row.card_equipped as string),
    card_pools: JSON.parse(row.card_pools as string),
    buyback_locked_tokens: row.buyback_locked_tokens as string,
    lp_locked_tokens: row.lp_locked_tokens as string,
    burned_tokens: row.burned_tokens as string,
    jackpot_round: Number(row.jackpot_round),
    created_at: Number(row.created_at),
  };
}

export async function getToken(mint: string): Promise<TokenRow | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM tokens WHERE mint = ?",
    args: [mint],
  });
  if (res.rows.length === 0) return null;
  return parseTokenRow(res.rows[0] as unknown as Record<string, unknown>);
}

export async function listTokens(search?: string): Promise<TokenRow[]> {
  await ensureSchema();
  const res = search
    ? await db.execute({
        sql: "SELECT * FROM tokens WHERE mint LIKE ? OR name LIKE ? OR symbol LIKE ? ORDER BY created_at DESC LIMIT 100",
        args: [`%${search}%`, `%${search}%`, `%${search}%`],
      })
    : await db.execute("SELECT * FROM tokens ORDER BY created_at DESC LIMIT 100");
  return res.rows.map((r) => parseTokenRow(r as unknown as Record<string, unknown>));
}

export async function createToken({
  mint,
  creator,
  name,
  symbol,
  uri,
}: {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
}): Promise<{ walletPubkey: string }> {
  await ensureSchema();
  const wallet = generateTokenWallet();
  await db.execute({
    sql: `INSERT INTO tokens (mint, creator, name, symbol, uri, wallet_pubkey, wallet_privkey_enc, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      mint,
      creator,
      name,
      symbol,
      uri,
      wallet.publicKey,
      wallet.encryptedSecretKey,
      Date.now(),
    ],
  });
  return { walletPubkey: wallet.publicKey };
}

export async function updateTokenState(
  mint: string,
  fields: Partial<
    Pick<
      TokenRow,
      | "total_fees_received"
      | "total_withdrawn"
      | "cards_unlocked"
      | "slots"
      | "card_equipped"
      | "card_pools"
      | "buyback_locked_tokens"
      | "lp_locked_tokens"
      | "burned_tokens"
      | "jackpot_round"
    >
  >
) {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    if (key === "slots" || key === "card_equipped" || key === "card_pools") {
      args.push(JSON.stringify(value));
    } else {
      args.push(value as string | number);
    }
  }
  if (sets.length === 0) return;
  args.push(mint);
  await db.execute({
    sql: `UPDATE tokens SET ${sets.join(", ")} WHERE mint = ?`,
    args,
  });
}

export async function getVoteState(mint: string, slotIndex: number): Promise<VoteStateRow | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM votes WHERE mint = ? AND slot_index = ?",
    args: [mint, slotIndex],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0] as unknown as Record<string, unknown>;
  return {
    mint: row.mint as string,
    slot_index: Number(row.slot_index),
    is_open: Boolean(row.is_open),
    start_ts: Number(row.start_ts),
    vote_counts: JSON.parse(row.vote_counts as string),
  };
}

export async function startVote(mint: string, slotIndex: number) {
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO votes (mint, slot_index, is_open, start_ts, vote_counts) VALUES (?, ?, 1, ?, ?)`,
    args: [mint, slotIndex, Math.floor(Date.now() / 1000), JSON.stringify(Array(NUM_CARD_TYPES).fill(0))],
  });
}

export async function hasVoted(mint: string, slotIndex: number, voter: string) {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT 1 FROM vote_records WHERE mint = ? AND slot_index = ? AND voter = ?",
    args: [mint, slotIndex, voter],
  });
  return res.rows.length > 0;
}

export async function castVote(
  mint: string,
  slotIndex: number,
  voter: string,
  cardId: number,
  newCounts: number[]
) {
  await db.batch([
    {
      sql: "INSERT INTO vote_records (mint, slot_index, voter, card_id, voted_at) VALUES (?, ?, ?, ?, ?)",
      args: [mint, slotIndex, voter, cardId, Date.now()],
    },
    {
      sql: "UPDATE votes SET vote_counts = ? WHERE mint = ? AND slot_index = ?",
      args: [JSON.stringify(newCounts), mint, slotIndex],
    },
  ]);
}

export async function closeVote(mint: string, slotIndex: number) {
  await db.execute({
    sql: "UPDATE votes SET is_open = 0 WHERE mint = ? AND slot_index = ?",
    args: [mint, slotIndex],
  });
}

export async function countJackpotEntrants(mint: string, round: number): Promise<number> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT COUNT(*) as c FROM jackpot_entries WHERE mint = ? AND round = ?",
    args: [mint, round],
  });
  return Number((res.rows[0] as unknown as { c: number }).c);
}

export async function hasEnteredJackpot(mint: string, round: number, wallet: string) {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT 1 FROM jackpot_entries WHERE mint = ? AND round = ? AND wallet = ?",
    args: [mint, round, wallet],
  });
  return res.rows.length > 0;
}

export async function enterJackpot(mint: string, round: number, wallet: string) {
  await db.execute({
    sql: "INSERT INTO jackpot_entries (mint, round, wallet, entered_at) VALUES (?, ?, ?, ?)",
    args: [mint, round, wallet, Date.now()],
  });
}

export async function listJackpotEntrants(mint: string, round: number): Promise<string[]> {
  const res = await db.execute({
    sql: "SELECT wallet FROM jackpot_entries WHERE mint = ? AND round = ?",
    args: [mint, round],
  });
  return res.rows.map((r) => (r as unknown as { wallet: string }).wallet);
}

export function emptySlotsArray(): number[] {
  return Array(NUM_SLOTS).fill(EMPTY_SLOT);
}
