"use client";

import Link from "next/link";
import { CARD_NAMES } from "@/lib/forge-program";
import { useForgeWallet } from "@/lib/useForgeWallet";

const CARD_INFO: Record<string, string> = {
  Buyback: "Routes earmarked fees into automatic token buys, locked forever.",
  Burn: "Buys tokens with its fee cut and burns them - real supply reduction.",
  LP: "Buys and locks tokens to deepen long-term price support.",
  Reward: "Accrues SOL that holders claim pro-rata to their current balance.",
  Jackpot: "Builds a prize pool from trading fees. One winner takes it all.",
};

const CARD_COLOR: Record<string, string> = {
  Buyback: "var(--card-buyback)",
  Burn: "var(--card-burn)",
  LP: "var(--card-lp)",
  Reward: "var(--card-reward)",
  Jackpot: "var(--card-jackpot)",
};

export default function Home() {
  const { connected, login, logout, publicKey } = useForgeWallet();

  return (
    <main>
      <div className="container">
        <nav className="nav">
          <div className="logo">FORGE</div>
          <div className="row">
            <Link href="/launch" className="btn btn-primary">
              Launch a token
            </Link>
            {connected ? (
              <button className="btn" onClick={logout}>
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
              </button>
            ) : (
              <button className="btn" onClick={login}>
                Log in
              </button>
            )}
          </div>
        </nav>

        <section className="hero">
          <h1>Build your token&apos;s economy with cards.</h1>
          <p>
            Forge is a Solana token platform where cards are programmable
            economic modules. Every token starts simple. As it generates
            trading activity, it unlocks cards that can be equipped to change
            how it works - permanently.
          </p>
          <div className="hero-actions">
            <Link href="/launch" className="btn btn-primary">
              Launch a token
            </Link>
            <a href="#how" className="btn">
              How it works
            </a>
          </div>
        </section>

        <section className="section" id="cards">
          <h2>The card system</h2>
          <p className="subtitle">
            Five programmable modules. Three active slots. Choose what your
            token optimizes for - once equipped, a card is locked forever.
          </p>
          <div className="deck">
            {CARD_NAMES.map((name) => (
              <div
                key={name}
                className="card"
                style={{ ["--card-color" as string]: CARD_COLOR[name] }}
              >
                <div className="card-name">{name}</div>
                <div className="card-desc">{CARD_INFO[name]}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="how">
          <h2>How it works</h2>
          <p className="subtitle">
            Trading builds the deck. The community decides what it becomes.
          </p>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <p>Launch a token on Forge, through real pump.fun trading.</p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <p>
                Trading activity generates progression for the token,
                tracked from real on-chain fees.
              </p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <p>Progress unlocks new protocol cards, one at a time.</p>
            </div>
            <div className="step">
              <div className="step-num">4</div>
              <p>
                Anyone can vote on which unlocked card fills the next slot -
                no token-weighting, most votes wins.
              </p>
            </div>
            <div className="step">
              <div className="step-num">5</div>
              <p>
                Once equipped, a card is locked into that slot forever and
                automatically routes its share of future fees.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Positioning</h2>
          <p className="subtitle" style={{ fontSize: 20, color: "var(--text)" }}>
            Launch a token. Unlock cards. Build your deck. Forge your
            economy.
          </p>
        </section>

        <div className="footer">Forge &middot; built on Solana</div>
      </div>
    </main>
  );
}
