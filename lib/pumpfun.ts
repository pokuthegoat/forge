import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import {
  PumpSdk,
  OnlinePumpSdk,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  feeSharingConfigPda,
} from "@pump-fun/pump-sdk";

/**
 * Thin wrapper around the real @pump-fun/pump-sdk, verified against its
 * actual installed type definitions (not guessed from docs). All coins here
 * are assumed SOL-quoted - this project doesn't support other quote mints.
 */

export function getPumpSdk() {
  return new PumpSdk();
}

export function getOnlinePumpSdk(connection: Connection) {
  return new OnlinePumpSdk(connection);
}

/**
 * Builds the instructions to launch a new token on real pump.fun: creates
 * the mint via create_v2 and performs an initial buy in the same
 * transaction. The mint keypair must sign.
 */
export async function buildLaunchInstructions({
  connection,
  creator,
  mint,
  name,
  symbol,
  uri,
  initialBuySol,
  slippage = 1,
}: {
  connection: Connection;
  creator: PublicKey;
  mint: Keypair;
  name: string;
  symbol: string;
  uri: string;
  initialBuySol: BN;
  slippage?: number;
}): Promise<TransactionInstruction[]> {
  const pumpSdk = getPumpSdk();
  const onlineSdk = getOnlinePumpSdk(connection);
  const global = await onlineSdk.fetchGlobal();

  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: await onlineSdk.fetchFeeConfig(),
    mintSupply: global.tokenTotalSupply,
    bondingCurve: null as never,
    amount: initialBuySol,
    quoteMint: NATIVE_MINT,
    quoteControl: null,
    creatorFeeBps: new BN(0),
  });

  return pumpSdk.createV2AndBuyInstructions({
    global,
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    creator,
    user: creator,
    amount,
    solAmount: initialBuySol.muln(100 + slippage).divn(100),
    mayhemMode: false,
  });
}

/** Sets up pump.fun creator-fee sharing so 100% of the creator fee cut flows
 * into this token's own Forge-custodied wallet, which is where all
 * card-mechanic accounting and routing lives (handled by our backend, not
 * an on-chain program). This is a ONE-TIME setup call per token - pump.fun
 * locks the shareholder list after the first updateFeeSharesV2 call. */
export async function buildFeeSharingSetupInstructions({
  creator,
  mint,
  forgeWallet,
}: {
  creator: PublicKey;
  mint: PublicKey;
  forgeWallet: PublicKey;
}): Promise<TransactionInstruction[]> {
  const pumpSdk = getPumpSdk();

  const createIx = await pumpSdk.createFeeSharingConfig({
    creator,
    mint,
    pool: null,
  });

  const updateIx = await pumpSdk.updateFeeSharesV2({
    authority: creator,
    mint,
    currentShareholders: [creator],
    newShareholders: [{ address: forgeWallet, shareBps: 10_000 }],
    quoteMint: NATIVE_MINT,
    quoteTokenProgram: TOKEN_PROGRAM_ID,
  });

  return [createIx, updateIx];
}

/** Permissionless: sweeps any pending pump.fun creator fees into the
 * token's Forge-custodied wallet's lamport balance. Call this before our
 * own backend's fee-sync logic to pull fresh trading fees in. */
export async function buildDistributeFeesInstructions({
  connection,
  mint,
  payer,
}: {
  connection: Connection;
  mint: PublicKey;
  payer: PublicKey;
}): Promise<TransactionInstruction[]> {
  const pumpSdk = getPumpSdk();
  const sharingConfigAddress = feeSharingConfigPda(mint);
  const accountInfo = await connection.getAccountInfo(sharingConfigAddress);
  if (!accountInfo) {
    throw new Error("Fee sharing has not been set up for this token yet");
  }
  const sharingConfig = pumpSdk.decodeSharingConfig(accountInfo);

  const distributeIx = await pumpSdk.distributeCreatorFeesV2({
    mint,
    sharingConfig,
    sharingConfigAddress,
    quoteMint: NATIVE_MINT,
    payer,
    shouldInitializeAta: true,
    quoteTokenProgram: TOKEN_PROGRAM_ID,
  });

  return [distributeIx];
}

/** Builds a buy transaction's instructions for an existing pump.fun token. */
export async function buildBuyInstructions({
  connection,
  mint,
  user,
  solAmount,
  slippage = 1,
}: {
  connection: Connection;
  mint: PublicKey;
  user: PublicKey;
  solAmount: BN;
  slippage?: number;
}): Promise<TransactionInstruction[]> {
  const pumpSdk = getPumpSdk();
  const onlineSdk = getOnlinePumpSdk(connection);
  const global = await onlineSdk.fetchGlobal();
  const feeConfig = await onlineSdk.fetchFeeConfig();
  const state = await onlineSdk.fetchBuyState(mint, user);

  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: global.tokenTotalSupply,
    bondingCurve: state.bondingCurve,
    amount: solAmount,
    quoteMint: state.quoteMint,
    quoteControl: null,
    creatorFeeBps: new BN(0),
  });

  return pumpSdk.buyInstructions({
    global,
    bondingCurveAccountInfo: state.bondingCurveAccountInfo,
    bondingCurve: state.bondingCurve,
    associatedUserAccountInfo: state.associatedUserAccountInfo,
    mint,
    user,
    amount,
    solAmount: solAmount.muln(100 + slippage).divn(100),
    slippage,
    tokenProgram: state.quoteTokenProgram,
  });
}

/** Builds a sell transaction's instructions for an existing pump.fun token. */
export async function buildSellInstructions({
  connection,
  mint,
  user,
  tokenAmount,
  slippage = 1,
}: {
  connection: Connection;
  mint: PublicKey;
  user: PublicKey;
  tokenAmount: BN;
  slippage?: number;
}): Promise<TransactionInstruction[]> {
  const pumpSdk = getPumpSdk();
  const onlineSdk = getOnlinePumpSdk(connection);
  const global = await onlineSdk.fetchGlobal();
  const state = await onlineSdk.fetchSellState(mint, user);

  const solAmount = getSellSolAmountFromTokenAmount({
    global,
    feeConfig: await onlineSdk.fetchFeeConfig(),
    mintSupply: global.tokenTotalSupply,
    bondingCurve: state.bondingCurve,
    amount: tokenAmount,
  });

  return pumpSdk.sellInstructions({
    global,
    bondingCurveAccountInfo: state.bondingCurveAccountInfo,
    bondingCurve: state.bondingCurve,
    mint,
    user,
    amount: tokenAmount,
    solAmount: solAmount.muln(100 - slippage).divn(100),
    slippage,
    tokenProgram: state.quoteTokenProgram,
    mayhemMode: false,
  });
}
