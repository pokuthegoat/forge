"use client";

import { useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import bs58 from "bs58";

const SOLANA_MAINNET = "solana:mainnet" as const;

/**
 * Wraps Privy's Solana hooks into the same shape the app's pages were
 * already written against (modeled on @solana/wallet-adapter-react's
 * useWallet) so switching auth providers didn't require rewriting every
 * page's transaction-building logic.
 */
export function useForgeWallet() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0] ?? null;

  const publicKey = useMemo(() => (wallet ? new PublicKey(wallet.address) : null), [wallet]);

  async function signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!wallet) throw new Error("No wallet connected");
    const { signature } = await wallet.signMessage({ message });
    return signature;
  }

  async function sendTransaction(tx: Transaction, connection: Connection): Promise<string> {
    if (!wallet) throw new Error("No wallet connected");
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const { signature } = await wallet.signAndSendTransaction({
      transaction: serialized,
      chain: SOLANA_MAINNET,
    });
    void connection;
    return bs58.encode(signature);
  }

  return {
    ready,
    authenticated,
    connected: authenticated && !!wallet,
    publicKey,
    login,
    logout,
    signMessage,
    sendTransaction,
  };
}
