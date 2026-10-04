"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  CARD_NAMES,
  CARD_DESCRIPTIONS,
  CARD_REWARD,
  CARD_JACKPOT,
  EMPTY_SLOT,
  NUM_SLOTS,
  UNLOCK_THRESHOLD_LAMPORTS,
  type TokenState,
} from "@/lib/forge-program";
import { buildDistributeFeesInstructions } from "@/lib/pumpfun";
import { useForgeWallet } from "@/lib/useForgeWallet";
import { getConnection } from "@/lib/solana-connection";
import { confirmOrThrow } from "@/lib/solana-tx";
import { Arrow } from "@/components/Buttons";
import { PublicKey, Transaction } from "@solana/web3.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

export default function TokenDashboard() {
  const params = useParams<{ mint: string }>();
  const mint = params.mint;
  const connection = getConnection();
  const wallet = useForgeWallet();

  const [token, setToken] = useState<TokenState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  const isCreator = Boolean(
    wallet.publicKey && token && wallet.publicKey.toBase58() === token.creator
  );

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

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
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
  const openSlotIndex = token.slots.findIndex((s) => s === EMPTY_SLOT);

  return (
    <main className="app-main">
      <div className="container">
        <section style={{ padding: "40px 0 20px" }}>
          <div className="token-head">
            <div>
              <h1 style={{ fontSize: 28 }}>
                {token.name} ({token.symbol})
              </h1>
              <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{mint}</p>
            </div>
            {isCreator && (
              <button type="button" className="pill" onClick={handleCopyLink}>
                {linkCopied ? "Copied!" : "Copy Link"}
              </button>
            )}
          </div>
          {status && <p style={{ color: "var(--text-dim)", marginTop: 10 }}>{status}</p>}
        </section>

        <a
          className="trade-link"
          href={`https://pump.fun/coin/${mint}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Trade on pump.fun
          <Arrow />
        </a>

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
        </div>

        <div className="card-table">
          <div className="table-slots">
            {Array.from({ length: NUM_SLOTS }).map((_, slotIndex) => {
              const cardId = token.slots[slotIndex];
              const filled = cardId !== EMPTY_SLOT;
              return (
                <div key={slotIndex} className={`table-slot${filled ? " is-filled" : ""}`}>
                  <span className="table-slot-label">Slot {slotIndex + 1}</span>
                  <span className={`table-slot-value${filled ? "" : " is-empty"}`}>
                    {filled ? CARD_NAMES[cardId] : "Open"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="deck-roster">
            {CARD_NAMES.map((name, cardId) => {
              const unlocked = cardId < token.cards_unlocked;
              const equipped = token.card_equipped[cardId];
              const voteDisabled = busy || !unlocked || equipped || openSlotIndex === -1;
              return (
                <div
                  key={name}
                  className={`playing-card${!unlocked ? " is-locked" : ""}${equipped ? " is-equipped" : ""}`}
                >
                  <span className="playing-card-rank">{String(cardId + 1).padStart(2, "0")}</span>
                  <span className="playing-card-name">{name}</span>
                  <span className="playing-card-desc">{CARD_DESCRIPTIONS[name]}</span>
                  <span className="playing-card-status">
                    {!unlocked ? "Locked" : equipped ? "Equipped" : "Unlocked"}
                  </span>
                  {!isCreator && !equipped && (
                    <button
                      className="playing-card-vote"
                      disabled={voteDisabled}
                      onClick={() => handleCastVote(openSlotIndex, cardId)}
                    >
                      Vote
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isCreator ? (
          <div className="role-panel-creator">
            <span className="role-panel-creator-label">Creator tools</span>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={handleSyncFees}>
              Sync fees
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={busy || !token.card_equipped[CARD_JACKPOT]}
              onClick={handleRollWinner}
            >
              Roll winner
            </button>
          </div>
        ) : (
          <div className="role-panel-public">
            <div className="panel" style={{ marginBottom: 0 }}>
              <h3>Reward</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                Claim your pro-rata share of the Reward card's pool.
              </p>
              <button
                className="btn btn-primary"
                disabled={busy || !token.card_equipped[CARD_REWARD]}
                onClick={handleClaimReward}
              >
                Claim reward
              </button>
            </div>
            <div className="panel" style={{ marginBottom: 0 }}>
              <h3>Jackpot</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                Pool: {(Number(token.card_pools[4]) / LAMPORTS_PER_SOL).toFixed(4)} SOL · Round {token.jackpot_round}
              </p>
              <button
                className="btn btn-primary"
                disabled={busy || !token.card_equipped[CARD_JACKPOT]}
                onClick={handleEnterJackpot}
              >
                Enter jackpot
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
