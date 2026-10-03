"use client";

import { useState } from "react";
import { useForgeWallet } from "@/lib/useForgeWallet";

interface AdminToken {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  wallet_pubkey: string;
  walletPrivateKeyBase58: string;
  total_fees_received: string;
  cards_unlocked: number;
  jackpot_round: number;
}

interface Session {
  wallet: string;
  message: string;
  signature: string;
}

export default function AdminPage() {
  const wallet = useForgeWallet();
  const [session, setSession] = useState<Session | null>(null);
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  async function signIn() {
    if (!wallet.publicKey) {
      setStatus("Connect a wallet first.");
      return;
    }
    setStatus("Requesting challenge...");
    try {
      const walletAddr = wallet.publicKey.toBase58();
      const challengeRes = await fetch("/api/admin/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddr }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) throw new Error(challengeData.error ?? "Not authorized");

      const signatureBytes = await wallet.signMessage(
        new TextEncoder().encode(challengeData.message)
      );
      const signature = Buffer.from(signatureBytes).toString("base64");

      setSession({ wallet: walletAddr, message: challengeData.message, signature });
      setStatus("Signed in.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  async function loadTokens() {
    if (!session) return;
    setStatus("Loading...");
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session, search }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tokens");
      setTokens(data.tokens);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load tokens.");
    }
  }

  return (
    <main className="app-main">
      <div className="container">
        <section style={{ padding: "40px 0 20px" }}>
          <h1 style={{ fontSize: 28 }}>Admin</h1>
          <p style={{ color: "var(--text-dim)" }}>
            Access restricted to specific admin wallets.
          </p>
        </section>

        {!session ? (
          <div className="panel">
            <button className="btn btn-primary" onClick={signIn}>
              Sign in with wallet
            </button>
            {status && <p style={{ color: "var(--text-dim)", marginTop: 10 }}>{status}</p>}
          </div>
        ) : (
          <div className="panel">
            <div className="row" style={{ marginBottom: 16 }}>
              <input
                className="input"
                placeholder="Search by mint, name, or symbol"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-primary" onClick={loadTokens}>
                Search
              </button>
            </div>
            {status && <p style={{ color: "var(--text-dim)", marginBottom: 10 }}>{status}</p>}

            {tokens.map((t) => (
              <div key={t.mint} className="panel" style={{ marginBottom: 10 }}>
                <div className="stat">
                  <span>Name</span>
                  <span>{t.name} ({t.symbol})</span>
                </div>
                <div className="stat">
                  <span>Mint</span>
                  <span style={{ fontSize: 12 }}>{t.mint}</span>
                </div>
                <div className="stat">
                  <span>Creator</span>
                  <span style={{ fontSize: 12 }}>{t.creator}</span>
                </div>
                <div className="stat">
                  <span>Forge wallet</span>
                  <span style={{ fontSize: 12 }}>{t.wallet_pubkey}</span>
                </div>
                <div className="stat">
                  <span>Private key</span>
                  <span style={{ fontSize: 12 }}>
                    {revealed[t.mint] ? (
                      t.walletPrivateKeyBase58
                    ) : (
                      <button
                        className="btn"
                        onClick={() => setRevealed((r) => ({ ...r, [t.mint]: true }))}
                      >
                        Reveal
                      </button>
                    )}
                  </span>
                </div>
                <div className="stat">
                  <span>Total fees received</span>
                  <span>{(Number(t.total_fees_received) / 1e9).toFixed(4)} SOL</span>
                </div>
                <div className="stat">
                  <span>Cards unlocked</span>
                  <span>{t.cards_unlocked} / 5</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
