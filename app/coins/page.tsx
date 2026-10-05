"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TokenState } from "@/lib/forge-program";

export default function CoinsPage() {
  const [tokens, setTokens] = useState<TokenState[] | null>(null);

  useEffect(() => {
    fetch("/api/tokens")
      .then((res) => res.json())
      .then(setTokens)
      .catch(() => setTokens([]));
  }, []);

  return (
    <main className="app-main">
      <div className="container">
        <section className="page-hero">
          <span className="t-eyebrow">Launched coins</span>
          <h1 className="t-h1" style={{ marginTop: 12 }}>
            Every coin launched on Forge.
          </h1>
        </section>

        <div className="pay-table">
          <div className="pay-row is-head">
            <span>Coin</span>
            <span>Cards unlocked</span>
            <span>Launched</span>
          </div>
          {tokens === null && (
            <div className="pay-row">
              <span>Loading...</span>
            </div>
          )}
          {tokens?.length === 0 && (
            <div className="pay-row">
              <span>No coins launched yet.</span>
            </div>
          )}
          {tokens?.map((t) => (
            <Link key={t.mint} href={`/token/${t.mint}`} className="pay-row">
              <span>
                <b>{t.name}</b> · ${t.symbol}
              </span>
              <span>{t.cards_unlocked} / 5</span>
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
