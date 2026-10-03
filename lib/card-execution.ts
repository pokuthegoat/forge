import "server-only";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createBurnInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { buildBuyInstructions } from "./pumpfun";
import { loadTokenKeypair } from "./wallet-custody";
import { updateTokenState, type TokenRow } from "./forge-db";
import { CARD_BUYBACK, CARD_BURN, CARD_LP } from "./forge-program";

async function tokenBalance(connection: Connection, mint: PublicKey, owner: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  try {
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return 0n;
  }
}

/** Spends a card's entire earmarked SOL pool buying the token on real
 * pump.fun, using the token's own custodial wallet as the signer - the
 * server holds this key directly, so there's no hand-off/trust gap like
 * the abandoned on-chain design needed. */
async function buyWithPool(
  connection: Connection,
  token: TokenRow,
  cardId: number
): Promise<bigint> {
  const pool = BigInt(token.card_pools[cardId]);
  if (pool === 0n) return 0n;

  const keypair = loadTokenKeypair(token.wallet_privkey_enc);
  const mint = new PublicKey(token.mint);

  const before = await tokenBalance(connection, mint, keypair.publicKey);

  const ixs = await buildBuyInstructions({
    connection,
    mint,
    user: keypair.publicKey,
    solAmount: new BN(pool.toString()),
  });

  const tx = new Transaction().add(...ixs);
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  const after = await tokenBalance(connection, mint, keypair.publicKey);
  const bought = after - before;

  const cardPools = token.card_pools.map((p) => BigInt(p));
  cardPools[cardId] = 0n;
  await updateTokenState(token.mint, { card_pools: cardPools.map((p) => p.toString()) });

  return bought;
}

/** Buyback: buys tokens with its pool, locks them forever (never sold). */
export async function executeBuyback(connection: Connection, token: TokenRow) {
  const bought = await buyWithPool(connection, token, CARD_BUYBACK);
  if (bought > 0n) {
    const locked = BigInt(token.buyback_locked_tokens) + bought;
    await updateTokenState(token.mint, { buyback_locked_tokens: locked.toString() });
  }
  return bought;
}

/** LP: same buy-and-lock mechanic as Buyback, tracked in a separate bucket.
 * Approximates liquidity support rather than literally depositing into
 * pump.fun's AMM pool. */
export async function executeLp(connection: Connection, token: TokenRow) {
  const bought = await buyWithPool(connection, token, CARD_LP);
  if (bought > 0n) {
    const locked = BigInt(token.lp_locked_tokens) + bought;
    await updateTokenState(token.mint, { lp_locked_tokens: locked.toString() });
  }
  return bought;
}

/** Burn: buys tokens with its pool, then actually burns them - real supply
 * reduction, executed directly by the server since it holds the wallet. */
export async function executeBurn(connection: Connection, token: TokenRow) {
  const bought = await buyWithPool(connection, token, CARD_BURN);
  if (bought === 0n) return 0n;

  const keypair = loadTokenKeypair(token.wallet_privkey_enc);
  const mint = new PublicKey(token.mint);
  const ata = getAssociatedTokenAddressSync(mint, keypair.publicKey);

  const burnIx = createBurnInstruction(ata, mint, keypair.publicKey, bought);
  const tx = new Transaction().add(burnIx);
  tx.feePayer = keypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(keypair);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  const burned = BigInt(token.burned_tokens) + bought;
  await updateTokenState(token.mint, { burned_tokens: burned.toString() });
  return bought;
}
