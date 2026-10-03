import "server-only";
import { Keypair } from "@solana/web3.js";
import { encryptSecret, decryptSecret } from "./crypto";

/** Generates a brand new Solana wallet for a token's fee collection. The
 * private key never leaves the server - callers only ever see the public
 * key and the encrypted blob to store. */
export function generateTokenWallet(): {
  publicKey: string;
  encryptedSecretKey: string;
} {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    encryptedSecretKey: encryptSecret(keypair.secretKey),
  };
}

export function loadTokenKeypair(encryptedSecretKey: string): Keypair {
  const secretKey = decryptSecret(encryptedSecretKey);
  return Keypair.fromSecretKey(secretKey);
}
