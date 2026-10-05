import "server-only";
import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

let initialized = false;

/** Creates all tables if they don't exist yet. Safe to call repeatedly. */
export async function ensureSchema() {
  if (initialized) return;
  await db.batch([
    `CREATE TABLE IF NOT EXISTS tokens (
      mint TEXT PRIMARY KEY,
      creator TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      uri TEXT NOT NULL,
      wallet_pubkey TEXT NOT NULL,
      wallet_privkey_enc TEXT NOT NULL,
      total_fees_received TEXT NOT NULL DEFAULT '0',
      total_withdrawn TEXT NOT NULL DEFAULT '0',
      cards_unlocked INTEGER NOT NULL DEFAULT 0,
      slots TEXT NOT NULL DEFAULT '[255,255,255]',
      card_equipped TEXT NOT NULL DEFAULT '[false,false,false,false,false]',
      card_pools TEXT NOT NULL DEFAULT '["0","0","0","0","0"]',
      buyback_locked_tokens TEXT NOT NULL DEFAULT '0',
      lp_locked_tokens TEXT NOT NULL DEFAULT '0',
      burned_tokens TEXT NOT NULL DEFAULT '0',
      jackpot_round INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS votes (
      mint TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1,
      start_ts INTEGER NOT NULL,
      vote_counts TEXT NOT NULL DEFAULT '[0,0,0,0,0]',
      PRIMARY KEY (mint, slot_index)
    )`,
    `CREATE TABLE IF NOT EXISTS vote_records (
      mint TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      voter TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      voted_at INTEGER NOT NULL,
      PRIMARY KEY (mint, slot_index, voter)
    )`,
    `CREATE TABLE IF NOT EXISTS reward_claims (
      mint TEXT NOT NULL,
      wallet TEXT NOT NULL,
      claimed TEXT NOT NULL DEFAULT '0',
      PRIMARY KEY (mint, wallet)
    )`,
    `CREATE TABLE IF NOT EXISTS jackpot_entries (
      mint TEXT NOT NULL,
      round INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      entered_at INTEGER NOT NULL,
      PRIMARY KEY (mint, round, wallet)
    )`,
    `CREATE TABLE IF NOT EXISTS admin_nonces (
      wallet TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS token_metadata (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ]);
  initialized = true;
}
