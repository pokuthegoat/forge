import type { Connection } from "@solana/web3.js";

export interface BlockhashInfo {
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Solana's confirmTransaction resolves successfully once a transaction is
 * CONFIRMED (included in a block) - it does NOT throw if the transaction
 * itself failed during execution. Checking only "was it confirmed" lets a
 * reverted/failed transaction silently look like a success. This checks the
 * actual execution result and throws with the real on-chain error if it
 * failed.
 *
 * Takes the blockhash the transaction was actually built with (not just a
 * signature + commitment) so confirmTransaction can poll until that
 * blockhash truly expires, rather than giving up on a fixed, often-too-short
 * timeout (the legacy signature-only overload bails after ~30s regardless of
 * whether the transaction is still perfectly able to land).
 */
export async function confirmOrThrow(
  connection: Connection,
  signature: string,
  blockhashInfo: BlockhashInfo,
  commitment: "confirmed" | "finalized" = "confirmed"
): Promise<void> {
  const result = await connection.confirmTransaction(
    { signature, ...blockhashInfo },
    commitment
  );
  if (result.value.err) {
    throw new Error(
      `Transaction ${signature} failed on-chain: ${JSON.stringify(result.value.err)}`
    );
  }
}
