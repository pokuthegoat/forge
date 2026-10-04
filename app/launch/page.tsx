"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import BN from "bn.js";

import { buildLaunchInstructions, buildFeeSharingSetupInstructions } from "@/lib/pumpfun";
import { Window } from "@/components/Window";
import { useForgeWallet } from "@/lib/useForgeWallet";
import { getConnection } from "@/lib/solana-connection";
import { confirmOrThrow } from "@/lib/solana-tx";
import { WALLET_BOOTSTRAP_LAMPORTS } from "@/lib/forge-program";

export default function LaunchPage() {
  const connection = getConnection();
  const wallet = useForgeWallet();
  const router = useRouter();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [initialBuy, setInitialBuy] = useState("0.1");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleImageChange(file: File | null) {
    setImageFile(file);
    if (!file) {
      setImagePreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleLaunch() {
    if (!wallet.publicKey) {
      setStatus("Connect a wallet first.");
      return;
    }
    if (!imageFile) {
      setStatus("Choose an image first.");
      return;
    }
    setBusy(true);
    try {
      setStatus("Uploading image...");
      const imageDataUri: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const metadataRes = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, symbol, imageDataUri, website, twitter, telegram }),
      });
      if (!metadataRes.ok) {
        const { error } = await metadataRes.json();
        throw new Error(error ?? "Failed to upload image");
      }
      const { uri } = await metadataRes.json();

      const mint = Keypair.generate();

      setStatus("Building launch transaction...");
      const launchIxs = await buildLaunchInstructions({
        connection,
        creator: wallet.publicKey,
        mint,
        name,
        symbol,
        uri,
        initialBuySol: new BN(Math.round(parseFloat(initialBuy) * 1e9)),
      });

      const tx1 = new Transaction().add(...launchIxs);
      tx1.feePayer = wallet.publicKey;
      const blockhash1 = await connection.getLatestBlockhash();
      tx1.recentBlockhash = blockhash1.blockhash;
      tx1.partialSign(mint);

      setStatus("Confirm the launch transaction in your wallet...");
      const sig1 = await wallet.sendTransaction(tx1, connection);
      await confirmOrThrow(connection, sig1, blockhash1);

      setStatus("Registering token with Forge...");
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: mint.publicKey.toBase58(),
          creator: wallet.publicKey.toBase58(),
          name,
          symbol,
          uri,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Failed to register token with Forge");
      }
      const { walletPubkey } = await res.json();

      setStatus("Setting up fee sharing...");
      const forgeWallet = new PublicKey(walletPubkey);
      const feeSharingIxs = await buildFeeSharingSetupInstructions({
        creator: wallet.publicKey,
        mint: mint.publicKey,
        forgeWallet,
      });

      // Seeds the new Forge wallet with a little SOL so it can pay the
      // (tiny) network fee to sweep its own pump.fun creator-fee payouts
      // later, without needing anyone else's wallet involved.
      const bootstrapIx = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: forgeWallet,
        lamports: WALLET_BOOTSTRAP_LAMPORTS,
      });

      const tx2 = new Transaction().add(bootstrapIx, ...feeSharingIxs);
      tx2.feePayer = wallet.publicKey;
      const blockhash2 = await connection.getLatestBlockhash();
      tx2.recentBlockhash = blockhash2.blockhash;

      setStatus("Confirm the fee-sharing transaction in your wallet...");
      const sig2 = await wallet.sendTransaction(tx2, connection);
      await confirmOrThrow(connection, sig2, blockhash2);

      setStatus("Launched! Redirecting...");
      router.push(`/token/${mint.publicKey.toBase58()}`);
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : "Launch failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-main">
      <div className="container">
        <section className="page-hero" style={{ padding: "60px 0" }}>
          <h1 style={{ fontSize: 36 }}>Launch a token</h1>
          <p>
            Launches for real on pump.fun. Forge then takes over the
            creator-fee cut to power the card system - cumulative trading
            fees unlock cards, and the community votes on your deck.
          </p>
        </section>

        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <Window title="DECK.EXE - Token Details" style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <input
                className="input"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="input"
                placeholder="Symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              />
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
                />
              </div>
              <input
                className="input"
                placeholder="Initial buy (SOL)"
                value={initialBuy}
                onChange={(e) => setInitialBuy(e.target.value)}
              />
            </div>
          </Window>

          <div style={{ display: "grid", gap: 20 }}>
            <Window title="PREVIEW.BMP">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Token preview"
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, flex: "none" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      border: "1px dashed var(--line-strong)",
                      flex: "none",
                    }}
                  />
                )}
                <div>
                  <div style={{ fontFamily: "var(--font-head)", fontSize: 19, fontWeight: 500 }}>
                    {name || "Token name"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    {symbol ? `$${symbol}` : "$SYMBOL"}
                  </div>
                </div>
              </div>
            </Window>

            <Window title="LINKS.CFG">
              <div style={{ display: "grid", gap: 14 }}>
                <input
                  className="input"
                  placeholder="Website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="X (Twitter)"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Telegram"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                />
              </div>
            </Window>

            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={busy || !name || !symbol || !imageFile}
              onClick={handleLaunch}
            >
              {busy ? "Launching..." : "Launch token"}
            </button>
            {status && (
              <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {status}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
