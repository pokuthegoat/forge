"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";

import {
  CARD_NAMES,
  EMPTY_SLOT,
  NUM_SLOTS,
  UNLOCK_THRESHOLD_LAMPORTS,
  type TokenState,
} from "@/lib/forge-program";
import { buildBuyInstructions, buildSellInstructions, buildDistributeFeesInstructions } from "@/lib/pumpfun";
import { useForgeWallet } from "@/lib/useForgeWallet";
import { getConnection } from "@/lib/solana-connection";
import { confirmOrThrow } from "@/lib/solana-tx";

const LAMPORTS_PER_SOL = 1_000_000_000;

export default function TokenDashboard() {
  const params = useParams<{ mint: string }>();
  const mint = params.mint;
  const connection = getConnection();
  const wallet = useForgeWallet();

  const [token, setToken] = useState<TokenState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyAmount, setBuyAmount] = useState("0.1");
  const [sellAmount, setSellAmount] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${mint}`);
      if (!res.ok) {
        setToken(null);
        return;
      }
      setToken(await res.json());
    } catch {
      setToken(null);
    }
  }, [mint]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function withStatus(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
      setStatus("Done.");
      await refresh();
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function postJson(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function handleBuy() {
    await withStatus("Buying...", async () => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      const ixs = await buildBuyInstructions({
        connection,
        mint: new PublicKey(mint),
        user: wallet.publicKey,
        solAmount: new BN(Math.round(parseFloat(buyAmount) * LAMPORTS_PER_SOL)),
      });
      const tx = new Transaction().add(...ixs);
      tx.feePayer = wallet.publicKey;
      const blockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash.blockhash;
      const sig = await wallet.sendTransaction(tx, connection);
      await confirmOrThrow(connection, sig, blockhash);
    });
  }

  async function handleSell() {
    await withStatus("Selling...", async () => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      const ixs = await buildSellInstructions({
        connection,
        mint: new PublicKey(mint),
        user: wallet.publicKey,
        tokenAmount: new BN(sellAmount),
      });
      const tx = new Transaction().add(...ixs);
      tx.feePayer = wallet.publicKey;
      const blockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash.blockhash;
      const sig = await wallet.sendTransaction(tx, connection);
      await confirmOrThrow(connection, sig, blockhash);
    });
  }

  async function handleSyncFees() {
    await withStatus("Sweeping pump.fun fees...", async () => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      const ixs = await buildDistributeFeesInstructions({
        connection,
        mint: new PublicKey(mint),
        payer: wallet.publicKey,
      });
      const tx = new Transaction().add(...ixs);
      tx.feePayer = wallet.publicKey;
      const blockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash.blockhash;
      const sig = await wallet.sendTransaction(tx, connection);
      await confirmOrThrow(connection, sig, blockhash);
    });
  }

  async function handleStartVote(slotIndex: number) {
    await withStatus("Opening vote...", () =>
      postJson(`/api/tokens/${mint}/vote/start`, { slotIndex })
    );
  }

  async function handleCastVote(slotIndex: number, cardId: number) {
    await withStatus("Casting vote...", async () => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      await postJson(`/api/tokens/${mint}/vote/cast`, {
        slotIndex,
        cardId,
        voter: wallet.publicKey.toBase58(),
      });
    });
  }

  async function handleFinalizeVote(slotIndex: number) {
    await withStatus("Finalizing vote...", () =>
      postJson(`/api/tokens/${mint}/vote/finalize`, { slotIndex })
    );
  }

  async function handleClaimReward() {
    await withStatus("Claiming reward...", async () => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      await postJson(`/api/tokens/${mint}/claim-reward`, {
        holder: wallet.publicKey.toBase58(),
      });
    });
  }

  async function handleEnterJackpot() {
    await withStatus("Entering jackpot...", async () => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      await postJson(`/api/tokens/${mint}/jackpot/enter`, {
        wallet: wallet.publicKey.toBase58(),
      });
    });
  }

  async function handleRollWinner() {
    await withStatus("Rolling jackpot winner...", async () => {
      if (!wallet.publicKey) {
        throw new Error("Connect a wallet first.");
      }
      const message = `Forge roll winner\nmint: ${mint}\ntimestamp: ${Date.now()}`;
      const signatureBytes = await wallet.signMessage(new TextEncoder().encode(message));
      const signature = Buffer.from(signatureBytes).toString("base64");
      await postJson(`/api/tokens/${mint}/jackpot/roll`, { message, signature });
    });
  }

  if (!token) {
    return (
      <main className="app-main">
        <div className="container">
          <div className="panel">
            <p>Loading this token's Forge state (or it hasn't been launched through Forge)...</p>
          </div>
        </div>
      </main>
    );
  }

  const nextThreshold = (token.cards_unlocked + 1) * UNLOCK_THRESHOLD_LAMPORTS;

  return (
    <main className="app-main">
      <div className="container">
        <section style={{ padding: "40px 0 20px" }}>
          <h1 style={{ fontSize: 28 }}>
            {token.name} ({token.symbol})
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{mint}</p>
          {status && <p style={{ color: "var(--text-dim)" }}>{status}</p>}
        </section>

        <div className="panel">
          <h3>Trade</h3>
          <div className="row" style={{ marginBottom: 10 }}>
            <input
              className="input"
              placeholder="SOL to spend"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
            />
            <button className="btn btn-primary" disabled={busy} onClick={handleBuy}>
              Buy
            </button>
          </div>
          <div className="row">
            <input
              className="input"
              placeholder="Tokens to sell"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
            />
            <button className="btn" disabled={busy} onClick={handleSell}>
              Sell
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Progression</h3>
          <div className="stat">
            <span>Total fees received</span>
            <span>{(Number(token.total_fees_received) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
          </div>
          <div className="stat">
            <span>Cards unlocked</span>
            <span>{token.cards_unlocked} / {CARD_NAMES.length}</span>
          </div>
          <div className="stat">
            <span>Next unlock at</span>
            <span>{(nextThreshold / LAMPORTS_PER_SOL).toFixed(2)} SOL</span>
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 10 }}>
            Progression and card execution sync automatically whenever this page loads,
            once the token's wallet has enough SOL to pay for it. If fees aren't showing
            up yet, sweep them manually below (costs you a tiny network fee).
          </p>
          <button className="btn" disabled={busy} style={{ marginTop: 10 }} onClick={handleSyncFees}>
            Sync fees from pump.fun
          </button>
        </div>

        <div className="panel">
          <h3>Deck</h3>
          <div className="slots-row" style={{ marginBottom: 20 }}>
            {Array.from({ length: NUM_SLOTS }).map((_, slotIndex) => {
              const cardId = token.slots[slotIndex];
              const filled = cardId !== EMPTY_SLOT;
              return (
                <div key={slotIndex} className={`slot ${filled ? "slot-filled" : ""}`}>
                  {filled ? CARD_NAMES[cardId] : `Slot ${slotIndex + 1} - empty`}
                  {!filled && (
                    <div style={{ marginTop: 10 }}>
                      <button className="btn" disabled={busy} onClick={() => handleStartVote(slotIndex)}>
                        Start vote
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        style={{ marginLeft: 8 }}
                        onClick={() => handleFinalizeVote(slotIndex)}
                      >
                        Finalize vote
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="deck">
            {CARD_NAMES.map((name, cardId) => {
              const unlocked = cardId < token.cards_unlocked;
              const equipped = token.card_equipped[cardId];
              const pool = Number(token.card_pools[cardId]) / LAMPORTS_PER_SOL;
              return (
                <div key={name} className="card">
                  <div className="card-name">{name}</div>
                  <div className="card-desc">Pool: {pool.toFixed(4)} SOL</div>
                  <span
                    className={`card-status ${
                      equipped ? "status-equipped" : unlocked ? "status-unlocked" : "status-locked"
                    }`}
                  >
                    {equipped ? "Equipped" : unlocked ? "Unlocked" : "Locked"}
                  </span>
                  {unlocked && !equipped && (
                    <div style={{ marginTop: 10 }}>
                      {Array.from({ length: NUM_SLOTS }).map((_, slotIndex) =>
                        token.slots[slotIndex] === EMPTY_SLOT ? (
                          <button
                            key={slotIndex}
                            className="btn"
                            disabled={busy}
                            style={{ marginRight: 6, marginBottom: 6 }}
                            onClick={() => handleCastVote(slotIndex, cardId)}
                          >
                            Vote for slot {slotIndex + 1}
                          </button>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h3>Reward</h3>
          <button className="btn btn-primary" disabled={busy} onClick={handleClaimReward}>
            Claim my reward share
          </button>
        </div>

        <div className="panel">
          <h3>Jackpot</h3>
          <div className="stat">
            <span>Current pool</span>
            <span>{(Number(token.card_pools[4]) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
          </div>
          <div className="stat">
            <span>Round</span>
            <span>{token.jackpot_round}</span>
          </div>
          <button
            className="btn btn-primary"
            disabled={busy}
            style={{ marginTop: 12 }}
            onClick={handleEnterJackpot}
          >
            Enter jackpot
          </button>
          {wallet.publicKey?.toBase58() === token.creator && (
            <button
              className="btn"
              disabled={busy}
              style={{ marginTop: 12, marginLeft: 8 }}
              onClick={handleRollWinner}
            >
              Roll winner (creator only)
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
