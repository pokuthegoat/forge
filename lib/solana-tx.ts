import type { Connection } from "@solana/web3.js";

/**
 * Solana's confirmTransaction resolves successfully once a transaction is
 * CONFIRMED (included in a block) - it does NOT throw if the transaction
 * itself failed during execution. Checking only "was it confirmed" lets a
 * reverted/failed transaction silently look like a success. This checks the
 * actual execution result and throws with the real on-chain error if it
 * failed.
 */
export async function confirmOrThrow(
  connection: Connection,
  signature: string,
  commitment: "confirmed" | "finalized" = "confirmed"
): Promise<void> {
  const result = await connection.confirmTransaction(signature, commitment);
  if (result.value.err) {
    throw new Error(
      `Transaction ${signature} failed on-chain: ${JSON.stringify(result.value.err)}`
    );
  }
}
