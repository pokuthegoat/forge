import "server-only";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getMint,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import {
  CARD_REWARD,
  EMPTY_SLOT,
  NUM_CARD_TYPES,
  UNLOCK_THRESHOLD_LAMPORTS,
} from "./forge-program";
import {
  getToken,
  updateTokenState,
  type TokenRow,
} from "./forge-db";
import { buildDistributeFeesInstructions } from "./pumpfun";
import { loadTokenKeypair } from "./wallet-custody";
import { confirmOrThrow } from "./solana-tx";

/** Minimum lamports the Forge wallet needs to self-pay the sweep's network
 * fee. A real transaction fee is ~5000 lamports; this leaves headroom. */
const MIN_BALANCE_TO_SWEEP = 10_000;

/** Permissionless, best-effort. pump.fun doesn't push creator-fee payouts
 * automatically - they sit in pump.fun's own internal vault until someone
 * calls its sweep instruction. This has the token's own Forge wallet pay
 * for and trigger that sweep using its small bootstrap SOL reserve, so
 * fees actually land in the wallet before syncFees checks its balance.
 * Safe to call anytime: no-ops quietly if there's nothing to sweep yet,
 * the wallet can't afford the fee, or fee sharing isn't set up. */
export async function sweepPumpFunFees(connection: Connection, token: TokenRow): Promise<void> {
  const keypair = loadTokenKeypair(token.wallet_privkey_enc);
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance < MIN_BALANCE_TO_SWEEP) return;

  try {
    const ixs = await buildDistributeFeesInstructions({
      connection,
      mint: new PublicKey(token.mint),
      payer: keypair.publicKey,
    });
    const tx = new Transaction().add(...ixs);
    tx.feePayer = keypair.publicKey;
    const blockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;
    tx.sign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await confirmOrThrow(connection, sig, blockhash);
  } catch (err) {
    // Expected/harmless: fee sharing not set up yet, nothing to distribute,
    // or a minimum-distributable-amount threshold not yet reached.
    console.error(`sweepPumpFunFees no-op for ${token.mint}:`, err);
  }
}

/** Permissionless. Reads the token's Forge wallet balance, figures out how
 * much new SOL has arrived since last sync, and splits it evenly across
 * whichever cards are currently equipped. Mirrors the old on-chain
 * sync_fees instruction, just running as a plain server function instead. */
export async function syncFees(connection: Connection, token: TokenRow): Promise<TokenRow> {
  const lamports = await connection.getBalance(new PublicKey(token.wallet_pubkey));
  const totalReceived = BigInt(token.total_fees_received);
  const totalWithdrawn = BigInt(token.total_withdrawn);
  const accounted = totalReceived - totalWithdrawn;
  const available = BigInt(lamports);
  const newFees = available > accounted ? available - accounted : 0n;

  if (newFees === 0n) return token;

  const updatedTotalReceived = totalReceived + newFees;
  const cardPools = token.card_pools.map((p) => BigInt(p));
  const equippedSlots = token.slots.filter((s) => s !== EMPTY_SLOT);

  if (equippedSlots.length > 0) {
    const share = newFees / BigInt(equippedSlots.length);
    const remainder = newFees % BigInt(equippedSlots.length);
    equippedSlots.forEach((cardId, i) => {
      cardPools[cardId] += share + (i === 0 ? remainder : 0n);
    });
  }

  await updateTokenState(token.mint, {
    total_fees_received: updatedTotalReceived.toString(),
    card_pools: cardPools.map((p) => p.toString()),
  });

  return {
    ...token,
    total_fees_received: updatedTotalReceived.toString(),
    card_pools: cardPools.map((p) => p.toString()),
  };
}

/** Permissionless. Unlocks the next card if cumulative fees crossed the
 * next tier threshold. */
export async function checkUnlock(token: TokenRow): Promise<{ unlocked: boolean; token: TokenRow }> {
  if (token.cards_unlocked >= NUM_CARD_TYPES) {
    return { unlocked: false, token };
  }
  const nextThreshold = BigInt(token.cards_unlocked + 1) * BigInt(UNLOCK_THRESHOLD_LAMPORTS);
  if (BigInt(token.total_fees_received) < nextThreshold) {
    return { unlocked: false, token };
  }
  const cardsUnlocked = token.cards_unlocked + 1;
  await updateTokenState(token.mint, { cards_unlocked: cardsUnlocked });
  return { unlocked: true, token: { ...token, cards_unlocked: cardsUnlocked } };
}

/** Tallies an open vote and returns the winning card id among eligible
 * (unlocked and not yet equipped) cards. Ties go to the lowest card id. */
export function pickVoteWinner(
  token: TokenRow,
  voteCounts: number[]
): number | null {
  let winner: number | null = null;
  let bestVotes = -1;
  for (let cardId = 0; cardId < token.cards_unlocked; cardId++) {
    if (token.card_equipped[cardId]) continue;
    const votes = voteCounts[cardId] ?? 0;
    if (winner === null || votes > bestVotes) {
      winner = cardId;
      bestVotes = votes;
    }
  }
  return winner;
}

/** Pro-rata reward payout for a holder, against the current Reward card
 * pool and the token's current circulating supply. */
export async function calculateRewardPayout(
  connection: Connection,
  token: TokenRow,
  holder: PublicKey
): Promise<bigint> {
  const mint = new PublicKey(token.mint);
  const mintInfo = await getMint(connection, mint);
  if (mintInfo.supply === 0n) return 0n;

  const ata = getAssociatedTokenAddressSync(mint, holder);
  let balance = 0n;
  try {
    const account = await getAccount(connection, ata);
    balance = account.amount;
  } catch {
    return 0n;
  }
  if (balance === 0n) return 0n;

  const pool = BigInt(token.card_pools[CARD_REWARD]);
  return (pool * balance) / mintInfo.supply;
}

export async function refreshToken(connection: Connection, mint: string): Promise<TokenRow | null> {
  const token = await getToken(mint);
  if (!token) return null;
  return syncFees(connection, token);
}
