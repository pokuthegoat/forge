"use client";

import { useEffect, useState } from "react";
import { CARD_NAMES, CARD_DESCRIPTIONS, CARD_NUMERALS, CARD_TICKERS, NUM_SLOTS, UNLOCK_THRESHOLD_LAMPORTS } from "@/lib/forge-program";
import { LaunchButton, HowItWorksButton, LinkButton } from "@/components/Buttons";
import { Faq } from "@/components/Faq";
import { HudPanel } from "@/components/HudPanel";
import { SegmentedMeter } from "@/components/SegmentedMeter";
import { RadialGauge } from "@/components/RadialGauge";
import { PixelArt, pokerChipCell, diamondCardCell, diceCell } from "@/components/PixelArt";

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

/** The landing page's CRT-desktop centerpiece: six Finder-style icons standing in for Forge's own
 * sections, cycling through the three casino pixel-art motifs instead of folders and documents. */
const CRT_ICONS = [
  { label: "Launch.exe", cell: pokerChipCell },
  { label: "Cards.dat", cell: diamondCardCell },
  { label: "Vote.sys", cell: diceCell },
  { label: "Fees.log", cell: pokerChipCell },
  { label: "Jackpot.bin", cell: diamondCardCell },
  { label: "Faq.hlp", cell: diceCell },
];

/** Sample rows for the WALLET.EXE ledger - flavor data standing in for a live feed, the same way the
 * ticking SOL counter above it is a demo, not a real wallet balance. */
const LEDGER_ROWS = [
  { id: "tok_4f21a0", card: "Buyback", amount: "0.014 SOL" },
  { id: "tok_dc0e37", card: "Burn", amount: "0.009 SOL" },
  { id: "tok_910139", card: "LP", amount: "0.021 SOL" },
  { id: "tok_b58ac1", card: "Reward", amount: "0.006 SOL" },
];

function useTickerValue() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 0.0137) % UNLOCK_SOL), 220);
    return () => clearInterval(id);
  }, []);
  return n;
}

export default function Home() {
  const tickerValue = useTickerValue();
  const pace = Math.round((tickerValue / UNLOCK_SOL) * 100);

  return (
    <main className="landing">
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

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="crt">
            <div className="crt-vents">
              {Array.from({ length: 5 }).map((_, i) => <span key={i} />)}
            </div>
            <div className="crt-screen">
              <div className="crt-icons">
                {CRT_ICONS.map((icon) => (
                  <div className="crt-icon" key={icon.label}>
                    <PixelArt size={48} grid={22} cell={icon.cell} />
                    <span className="crt-icon-label">{icon.label}</span>
                  </div>
                ))}
              </div>
              <div className="crt-brand">
                <span>Forge OS</span>
                <span>{NUM_SLOTS} slots / 5 cards</span>
              </div>
            </div>
          </div>
          <div className="crt-stand" />
          <div className="crt-base" />
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-head">
            <span className="t-eyebrow section-num"><b>01</b>Launch</span>
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
            <HudPanel label="WALLET.SYS" tag="SAMPLE DATA" bodyStyle={{ background: "var(--orange)", color: "var(--bg)" }}>
              <div className="progress-card">
                <div className="progress-top">
                  <span className="t-eyebrow">Forge wallet</span>
                  <span className="chip is-live">Sweeping fees</span>
                </div>
                <div>
                  <div className="progress-amount">
                    {tickerValue.toFixed(3)}
                    <small>/ {UNLOCK_SOL} SOL to next card</small>
                  </div>
                  <SegmentedMeter progress={tickerValue / UNLOCK_SOL} />
                </div>
                <RadialGauge progress={tickerValue / UNLOCK_SOL} score={`${pace}%`} label="On pace" />
                <div className="progress-meta">
                  <span>Cards unlocked 0 / 5</span>
                  <span>Slots filled 0 / {NUM_SLOTS}</span>
                </div>
                <div className="pipeline">
                  <span className="pipeline-step">Fees swept</span>
                  <span className="pipeline-arrow">›</span>
                  <span className="pipeline-step">Split evenly</span>
                  <span className="pipeline-arrow">›</span>
                  <span className="pipeline-step">Card pools</span>
                </div>
              </div>
            </HudPanel>
          </div>
        </div>
      </section>

      <section className="section band-earn">
        <div className="container earn-inner">
          <span className="t-eyebrow section-num">The deck</span>
          <div className="earn-giant">
            <span className="earn-num">5</span>
            <span className="earn-per">cards. Only {NUM_SLOTS} ever make the cut.</span>
          </div>
          <p className="t-lead earn-lead">
            Every token picks {NUM_SLOTS} of 5 - Buyback, Burn, LP, Reward, Jackpot.
            The other two never run. That choice, made by whoever shows up to
            vote, is what gives each token its own shape.
          </p>
        </div>
      </section>

      <section className="section" id="what-its-for">
        <div className="container">
          <div className="split">
            <div className="split-text">
              <span className="t-eyebrow section-num"><b>02</b>What it's for</span>
              <h2 className="t-h1">Most tokens have nothing to show for their own volume.</h2>
              <p className="t-body t-muted">
                Fees get paid on every trade whether or not anyone benefits
                from them. Forge routes that cut back into the token itself -
                support, supply, or holders - decided in the open, by whoever
                shows up to vote.
              </p>
            </div>
            <HudPanel label="INFO.TXT">
              <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 18 }}>
                <PixelArt size={56} grid={24} cell={pokerChipCell} />
                <PixelArt size={56} grid={24} cell={diamondCardCell} />
              </div>
              <p className="t-h3" style={{ marginBottom: 14 }}>No action, no upside.</p>
              <p className="t-body t-muted">
                A token that never unlocks a card just trades like any other
                pump.fun launch. The deck only does something once trading
                earns it the right to.
              </p>
            </HudPanel>
          </div>

          <HudPanel label="TRUST.SYS" style={{ marginTop: 48 }}>
            <div className="feature-strip">
              <div className="feature-tile">
                <div className="feature-tile-icon"><PixelArt size={40} grid={22} cell={pokerChipCell} /></div>
                <div>
                  <h4>Real fees, swept live</h4>
                  <p>Pulled straight from the token's own pump.fun activity - nothing simulated.</p>
                </div>
              </div>
              <div className="feature-tile">
                <div className="feature-tile-icon"><PixelArt size={40} grid={22} cell={diamondCardCell} /></div>
                <div>
                  <h4>One wallet, one vote</h4>
                  <p>No weighting by bag size - every holder gets the same single say.</p>
                </div>
              </div>
              <div className="feature-tile">
                <div className="feature-tile-icon"><PixelArt size={40} grid={22} cell={diceCell} /></div>
                <div>
                  <h4>Permanent once locked</h4>
                  <p>Every decision sticks for the life of the token - no re-rolling a slot.</p>
                </div>
              </div>
            </div>
          </HudPanel>
        </div>
      </section>

      <section className="section" id="cards">
        <div className="container">
          <div className="section-head">
            <span className="t-eyebrow section-num"><b>03</b>The cards</span>
            <h2 className="t-h1">Five cards. {NUM_SLOTS} slots. Pick a deck.</h2>
            <p className="t-lead">
              Every card draws from the same pool of fees and unlocks at its own
              tier of cumulative fees. Which {NUM_SLOTS} actually run is the one
              thing every holder gets a say in.
            </p>
          </div>
          <HudPanel label="DECK.DAT">
            <div className="card-table" style={{ margin: 0, border: 0, boxShadow: "none", padding: 0 }}>
              <div className="deck-roster">
                {CARD_NAMES.map((name, i) => (
                  <div className="playing-card" key={name}>
                    <div className="playing-card-top">
                      <span className="playing-card-rank">{CARD_NUMERALS[i]}</span>
                      <span className="ticker-tag">{CARD_TICKERS[i]}</span>
                    </div>
                    <span className="playing-card-name">{name}</span>
                    <span className="playing-card-desc">{CARD_DESCRIPTIONS[name]}</span>
                    <span className="playing-card-status">Unlocks at {UNLOCK_SOL * (i + 1)} SOL</span>
                  </div>
                ))}
              </div>
            </div>
          </HudPanel>
        </div>
      </section>

      <section className="section" id="trading">
        <div className="container">
          <div className="split">
            <div className="split-text">
              <span className="t-eyebrow section-num"><b>04</b>Trading happens on pump.fun</span>
              <h2 className="t-h1">Forge doesn't run the market. It just watches the fees.</h2>
              <p className="t-body t-muted">
                Every buy and sell goes straight through pump.fun's own bonding
                curve - the same one the rest of the market already trades on.
                Forge's only job is sweeping the creator-fee cut as it lands
                and keeping score toward the next unlock.
              </p>
              <LinkButton href="/launch" variant="outline">See a live token</LinkButton>
            </div>
            <HudPanel label="WALLET.EXE" tag="SAMPLE DATA">
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
              <div className="pipeline" style={{ marginTop: 18 }}>
                <span className="pipeline-step">Fee received</span>
                <span className="pipeline-arrow">›</span>
                <span className="pipeline-step">Verified</span>
                <span className="pipeline-arrow">›</span>
                <span className="pipeline-step">Routed</span>
              </div>
              <div className="ledger" style={{ marginTop: 14 }}>
                {LEDGER_ROWS.map((row) => (
                  <div className="ledger-row" key={row.id}>
                    <span className="ledger-id">{row.id}</span>
                    <span className="ledger-meta">{row.card}</span>
                    <span className="ledger-meta">{row.amount}</span>
                    <span className="ledger-status">Routed</span>
                  </div>
                ))}
              </div>
            </HudPanel>
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
            <span className="t-eyebrow section-num">FAQ</span>
            <h2 className="t-h1">Questions, answered plainly.</h2>
          </div>
          <Faq items={FAQ_ITEMS} title="FAQ.HLP" />
        </div>
      </section>

      <section className="band-ink">
        <div className="container final">
          <div className="casino-border" style={{ marginBottom: 36 }}>
            <PixelArt size={40} grid={22} cell={pokerChipCell} />
            <PixelArt size={40} grid={22} cell={diamondCardCell} />
            <PixelArt size={40} grid={22} cell={diceCell} />
            <PixelArt size={40} grid={22} cell={pokerChipCell} />
            <PixelArt size={40} grid={22} cell={diamondCardCell} />
          </div>
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
        <div className="casino-border is-footer">
          <PixelArt size={28} grid={18} cell={pokerChipCell} />
          <PixelArt size={28} grid={18} cell={diamondCardCell} />
          <PixelArt size={28} grid={18} cell={diceCell} />
          <PixelArt size={28} grid={18} cell={pokerChipCell} />
          <PixelArt size={28} grid={18} cell={diamondCardCell} />
          <PixelArt size={28} grid={18} cell={diceCell} />
        </div>
        <div className="container footer-inner">
          <span className="logo">FORGE</span>
          <span>Built on Solana - trades on pump.fun</span>
        </div>
      </footer>
    </main>
  );
}
