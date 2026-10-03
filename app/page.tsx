"use client";

import { useEffect, useState } from "react";
import { CARD_NAMES, NUM_SLOTS, UNLOCK_THRESHOLD_LAMPORTS } from "@/lib/forge-program";
import { LaunchButton, HowItWorksButton, LinkButton } from "@/components/Buttons";
import { Faq } from "@/components/Faq";

const CARD_INFO: Record<string, string> = {
  Buyback: "Takes its cut of trading fees and buys the token on the open market, forever.",
  Burn: "Buys the token with its fee cut, then burns it. Supply goes down, for good.",
  LP: "Buys the token and locks it as liquidity, deepening the pool a token trades against.",
  Reward: "Banks its fee cut in SOL. Holders claim their share, pro-rata to what they hold.",
  Jackpot: "Banks its fee cut into a pot. One holder, picked at random, takes all of it.",
};

const UNLOCK_SOL = UNLOCK_THRESHOLD_LAMPORTS / 1e9;

const FAQ_ITEMS = [
  {
    q: "Is this an actual pump.fun launch?",
    a: "Yes. Forge calls the real pump.fun program to create and trade the token - same bonding curve, same chart, same thing anyone can already trade on pump.fun. Forge doesn't simulate anything; it sits on top of the creator-fee cut.",
  },
  {
    q: "Where do the fees actually sit?",
    a: "Each token gets its own wallet, generated when it launches. Pump.fun's creator-fee share for that token routes there, and Forge sweeps it in automatically. Nobody, including Forge, holds it anywhere else.",
  },
  {
    q: `Why ${UNLOCK_SOL} SOL?`,
    a: `${UNLOCK_SOL} SOL of cumulative fees unlocks the first card. The next one needs ${UNLOCK_SOL * 2} SOL total, the one after that ${UNLOCK_SOL * 3}, and so on. It's a running total from real trading, not a reset meter - a token never loses unlocked progress.`,
  },
  {
    q: "Who decides which card gets equipped?",
    a: "Anyone can vote once a slot's card tier unlocks. One wallet, one vote - no token-weighting, no minimum holding. Most votes wins when the window closes, and that card is locked into the slot forever.",
  },
  {
    q: `Why only ${NUM_SLOTS} slots for 5 cards?`,
    a: "Three slots mean every token's deck is a real decision, not a checklist. Two cards will always be the ones you didn't pick - that's what gives a token a shape of its own.",
  },
  {
    q: "Can a card be swapped out later?",
    a: "No. Once a card fills a slot, it stays there and keeps routing its share of fees that way for the life of the token. That permanence is the point - it's what the vote is actually deciding.",
  },
];

function TickerAmount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 0.0137) % UNLOCK_SOL), 220);
    return () => clearInterval(id);
  }, []);
  return <>{n.toFixed(3)}</>;
}

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-inner container">
          <div className="hero-left">
            <div className="hero-badges">
              <span className="badge"><i />Live on pump.fun</span>
              <span className="badge">Solana</span>
              <span className="badge">{NUM_SLOTS} slots / 5 cards</span>
            </div>
            <h1 className="t-display hero-title">
              <span className="line">Every token gets a</span>{" "}
              <span className="line"><span className="mark">deck.</span> Trading</span>{" "}
              <span className="line">fills it in.</span>
            </h1>
            <div className="hero-sub">
              <p className="t-lead is-lg">
                Launch for real on pump.fun. Its trading fees fund {NUM_SLOTS} card slots
                - Buyback, Burn, LP, Reward, Jackpot - and the community votes on
                which ones a token keeps. Forever.
              </p>
              <div className="hero-cta">
                <LaunchButton />
                <HowItWorksButton />
              </div>
              <p className="hero-note">
                No presale. No team allocation. Just a wallet and a pump.fun launch.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-head">
            <span className="t-eyebrow section-num">01 - Launch</span>
            <h2 className="t-h1">You launch the token. The fees do the rest.</h2>
          </div>

          <div className="split" style={{ marginTop: 48 }}>
            <div className="split-text">
              <p className="t-body t-muted">
                Pick a name, a symbol, an image, and an optional dev buy - the
                rest is one pump.fun transaction. From the moment it's trading,
                every fee it earns counts toward unlocking its deck.
              </p>
              <p className="t-body t-muted">
                There's no separate token for Forge, no staking step, no
                allocation held back for later. The coin you launch is the
                whole thing.
              </p>
              <LinkButton href="/launch">Launch your token</LinkButton>
            </div>
            <div className="progress-card">
              <div className="progress-top">
                <span className="t-eyebrow">Forge wallet</span>
                <span className="chip is-live">Sweeping fees</span>
              </div>
              <div>
                <div className="progress-amount">
                  <TickerAmount />
                  <small>/ {UNLOCK_SOL} SOL to next card</small>
                </div>
              </div>
              <div className="progress-meta">
                <span>Cards unlocked 0 / 5</span>
                <span>Slots filled 0 / {NUM_SLOTS}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-earn">
        <div className="container earn-inner">
          <span className="t-eyebrow section-num">02 - Where the fees go</span>
          <div className="earn-giant">
            <span className="earn-num">{UNLOCK_SOL}</span>
            <span className="earn-per">SOL in cumulative fees unlocks the next card.</span>
          </div>
          <p className="t-lead earn-lead">
            Every trade - buy or sell - pays a creator fee under pump.fun's own
            rules. Forge doesn't add a fee on top; it just gives the one that
            already exists somewhere to land.
          </p>
        </div>
      </section>

      <section className="section" id="what-its-for">
        <div className="container">
          <div className="split">
            <div className="split-text">
              <span className="t-eyebrow section-num">03 - What it's for</span>
              <h2 className="t-h1">Most tokens have nothing to show for their own volume.</h2>
              <p className="t-body t-muted">
                Fees get paid on every trade whether or not anyone benefits
                from them. Forge routes that cut back into the token itself -
                support, supply, or holders - decided in the open, by whoever
                shows up to vote.
              </p>
              <ul className="req-list">
                <li>Real fees, swept from the token's own pump.fun activity</li>
                <li>One wallet, one vote - no weighting by bag size</li>
                <li>Every decision is permanent once a slot locks</li>
              </ul>
            </div>
            <div className="box" style={{ padding: "clamp(20px,2.4vw,30px)" }}>
              <p className="t-h3" style={{ marginBottom: 14 }}>No action, no upside.</p>
              <p className="t-body t-muted">
                A token that never unlocks a card just trades like any other
                pump.fun launch. The deck only does something once trading
                earns it the right to.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="cards">
        <div className="container">
          <div className="section-head">
            <span className="t-eyebrow section-num">04 - The cards</span>
            <h2 className="t-h1">Five cards. {NUM_SLOTS} slots. Pick a deck.</h2>
            <p className="t-lead">
              Every card draws from the same pool of fees. Which {NUM_SLOTS} actually run
              is the one thing every holder gets a say in.
            </p>
          </div>
          <div className="cards-row">
            {CARD_NAMES.map((name, i) => (
              <div className="card-tile" key={name} style={{ ["--tile-color" as string]: i === 4 ? "#ffffff" : "var(--orange)" }}>
                <span className="card-tile-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{name}</h3>
                <p>{CARD_INFO[name]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="unlock-pace">
        <div className="container">
          <div className="section-head">
            <span className="t-eyebrow section-num">05 - Unlock pace</span>
            <h2 className="t-h1">Progress never resets. It only adds up.</h2>
            <p className="t-lead">
              Every card unlocks at a fixed multiple of {UNLOCK_SOL} SOL in
              cumulative fees - counted from the token's first trade, not from
              whenever someone last checked.
            </p>
          </div>
          <div className="pay-table">
            <div className="pay-row is-head">
              <span>Card</span>
              <span>Unlocks at</span>
              <span>Cumulative fees</span>
            </div>
            {CARD_NAMES.map((name, i) => (
              <div className="pay-row" key={name}>
                <span><b>{name}</b></span>
                <span>Tier {i + 1}</span>
                <span className="amt">{UNLOCK_SOL * (i + 1)} SOL</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="trading">
        <div className="container">
          <div className="split">
            <div className="split-text">
              <span className="t-eyebrow section-num">06 - Trading happens on pump.fun</span>
              <h2 className="t-h1">Forge doesn't run the market. It just watches the fees.</h2>
              <p className="t-body t-muted">
                Every buy and sell goes straight through pump.fun's own bonding
                curve - the same one the rest of the market already trades on.
                Forge's only job is sweeping the creator-fee cut as it lands
                and keeping score toward the next unlock.
              </p>
              <LinkButton href="/launch" variant="outline">See a live token</LinkButton>
            </div>
            <div className="app-window">
              <div className="app-bar">
                <i /><i /><i /><span>token wallet</span>
              </div>
              <div className="app-body">
                <div className="app-gpu">
                  <div>
                    <b>Forge wallet</b>
                    <small>Auto-swept from pump.fun</small>
                  </div>
                  <span className="chip">Synced</span>
                </div>
                <div className="app-grid">
                  <div className="app-tile">
                    <small>Fees received</small>
                    <b>2.740</b>
                    <span className="meter"><i style={{ width: "55%" }} /></span>
                  </div>
                  <div className="app-tile">
                    <small>Cards unlocked</small>
                    <b>0 / 5</b>
                    <span className="meter"><i style={{ width: "0%" }} /></span>
                  </div>
                  <div className="app-tile">
                    <small>Next unlock</small>
                    <b>2.260 left</b>
                    <span className="meter"><i style={{ width: "55%" }} /></span>
                  </div>
                </div>
                <div className="app-toggle">Vote opens once this tier unlocks</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="interlude">
        <div className="container">
          <p className="interlude-line">
            A fee that already exists.
            <span>Pointed somewhere, for once.</span>
          </p>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <div className="section-head">
            <span className="t-eyebrow section-num">07 - FAQ</span>
            <h2 className="t-h1">Questions, answered plainly.</h2>
          </div>
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      <section className="band-ink">
        <div className="container final">
          <h2 className="t-display" style={{ fontSize: "clamp(36px,5.4vw,80px)" }}>
            Launch it. Let the fees decide.
          </h2>
          <div className="actions">
            <LaunchButton />
            <HowItWorksButton variant="outline" />
          </div>
          <p className="contact-line">
            Forge is built on Solana, trades through pump.fun, and keeps no
            cut of its own beyond what the cards route. Questions that aren't
            covered above - ask in the token's own community.
          </p>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <span className="logo">FORGE</span>
          <span>Built on Solana - trades on pump.fun</span>
        </div>
      </footer>
    </main>
  );
}
