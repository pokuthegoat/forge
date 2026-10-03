export const CARD_BUYBACK = 0;
export const CARD_BURN = 1;
export const CARD_LP = 2;
export const CARD_REWARD = 3;
export const CARD_JACKPOT = 4;

export const CARD_NAMES = ["Buyback", "Burn", "LP", "Reward", "Jackpot"] as const;

export const NUM_SLOTS = 3;
export const NUM_CARD_TYPES = 5;
export const EMPTY_SLOT = 255;

/** Lamports of cumulative trading fees that must have landed in a token's
 * Forge wallet, per tier, before the next card unlocks. */
export const UNLOCK_THRESHOLD_LAMPORTS = 5_000_000_000;

/** How long a vote stays open once a slot's card tier unlocks, before
 * anyone can finalize it. */
export const VOTE_WINDOW_SECS = 60 * 60;

/** Lamports sent to a new token's Forge wallet at launch so it can pay the
 * network fee to sweep its own pump.fun creator-fee payouts later. Not
 * trading revenue - excluded from progression tracking by seeding
 * total_fees_received with this amount when the token row is created. */
export const WALLET_BOOTSTRAP_LAMPORTS = 3_000_000;

export interface TokenState {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  wallet_pubkey: string;
  total_fees_received: string;
  total_withdrawn: string;
  cards_unlocked: number;
  slots: number[];
  card_equipped: boolean[];
  card_pools: string[];
  buyback_locked_tokens: string;
  lp_locked_tokens: string;
  burned_tokens: string;
  jackpot_round: number;
  created_at: number;
}

export interface VoteStateRow {
  mint: string;
  slot_index: number;
  is_open: boolean;
  start_ts: number;
  vote_counts: number[];
}
