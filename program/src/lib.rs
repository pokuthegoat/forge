use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

declare_id!("11111111111111111111111111111111");

pub const NUM_CARD_TYPES: usize = 5;
pub const NUM_SLOTS: usize = 3;
pub const EMPTY_SLOT: u8 = 255;
pub const MAX_JACKPOT_ENTRANTS: u16 = 256;

pub const CARD_BUYBACK: u8 = 0;
pub const CARD_BURN: u8 = 1;
pub const CARD_LP: u8 = 2;
pub const CARD_REWARD: u8 = 3;
pub const CARD_JACKPOT: u8 = 4;

pub const UNLOCK_THRESHOLD_LAMPORTS: u64 = 5_000_000_000;
pub const VOTE_WINDOW_SECS: i64 = 60 * 60;

#[error_code]
pub enum ForgeError {
    #[msg("All card slots are already filled")]
    NoSlotsAvailable,
    #[msg("A vote is already open for this slot")]
    VoteAlreadyOpen,
    #[msg("No vote is open for this slot")]
    VoteNotOpen,
    #[msg("Voting window has not closed yet")]
    VoteWindowNotElapsed,
    #[msg("Wallet has already voted in this round")]
    AlreadyVoted,
    #[msg("Card id is out of range")]
    InvalidCardId,
    #[msg("Card is not currently unlocked")]
    CardNotUnlocked,
    #[msg("Card has already been equipped in a slot and is locked forever")]
    CardAlreadyEquipped,
    #[msg("Not enough new trading fees have accrued to unlock the next card")]
    UnlockThresholdNotMet,
    #[msg("Caller is not the token creator/authority")]
    NotAuthority,
    #[msg("Wallet does not hold any of the token")]
    NotAHolder,
    #[msg("Wallet has already entered this jackpot round")]
    AlreadyEntered,
    #[msg("No entrants in this jackpot round")]
    NoEntrants,
    #[msg("Jackpot entrant list is full for this round")]
    JackpotFull,
    #[msg("Provided remaining accounts don't match the entrant count for this round")]
    EntrantMismatch,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Card pool does not have enough earmarked SOL for this execution")]
    InsufficientPool,
    #[msg("Arithmetic overflow")]
    Overflow,
}

#[account]
pub struct ForgeConfig {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub bump: u8,
    pub total_fees_received: u64,
    pub total_withdrawn: u64,
    pub cards_unlocked: u8,
    pub slots: [u8; NUM_SLOTS],
    pub card_equipped: [bool; NUM_CARD_TYPES],
    pub card_pools: [u64; NUM_CARD_TYPES],
    pub buyback_locked_tokens: u64,
    pub lp_locked_tokens: u64,
    pub burned_tokens: u64,
    pub jackpot_round: u64,
    pub jackpot_entrant_count: u16,
}

impl ForgeConfig {
    pub const SIZE: usize = 8
        + 32
        + 32
        + 1
        + 8
        + 8
        + 1
        + NUM_SLOTS
        + NUM_CARD_TYPES
        + 8 * NUM_CARD_TYPES
        + 8
        + 8
        + 8
        + 8
        + 2;
}

#[account]
pub struct VoteState {
    pub mint: Pubkey,
    pub slot_index: u8,
    pub bump: u8,
    pub is_open: bool,
    pub start_ts: i64,
    pub vote_counts: [u32; NUM_CARD_TYPES],
}

impl VoteState {
    pub const SIZE: usize = 8 + 32 + 1 + 1 + 1 + 8 + 4 * NUM_CARD_TYPES;
}

#[account]
pub struct VoteRecord {
    pub voted: bool,
}

impl VoteRecord {
    pub const SIZE: usize = 8 + 1;
}

#[account]
pub struct JackpotEntry {
    pub wallet: Pubkey,
    pub round: u64,
}

impl JackpotEntry {
    pub const SIZE: usize = 8 + 32 + 8;
}

#[program]
pub mod forge_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.forge_config;
        config.mint = ctx.accounts.mint.key();
        config.creator = ctx.accounts.creator.key();
        config.bump = ctx.bumps.forge_config;
        config.total_fees_received = 0;
        config.total_withdrawn = 0;
        config.cards_unlocked = 0;
        config.slots = [EMPTY_SLOT; NUM_SLOTS];
        config.card_equipped = [false; NUM_CARD_TYPES];
        config.card_pools = [0; NUM_CARD_TYPES];
        config.buyback_locked_tokens = 0;
        config.lp_locked_tokens = 0;
        config.burned_tokens = 0;
        config.jackpot_round = 0;
        config.jackpot_entrant_count = 0;
        Ok(())
    }

    pub fn sync_fees(ctx: Context<SyncFees>) -> Result<()> {
        let config = &mut ctx.accounts.forge_config;
        let info = config.to_account_info();
        let rent_minimum = Rent::get()?.minimum_balance(info.data_len());
        let lamports = info.lamports();

        let accounted = config
            .total_fees_received
            .checked_sub(config.total_withdrawn)
            .ok_or(ForgeError::Overflow)?;
        let available = lamports.saturating_sub(rent_minimum);
        let new_fees = available.saturating_sub(accounted);

        if new_fees == 0 {
            return Ok(());
        }

        config.total_fees_received = config
            .total_fees_received
            .checked_add(new_fees)
            .ok_or(ForgeError::Overflow)?;

        let equipped: Vec<usize> = config
            .slots
            .iter()
            .filter(|&&s| s != EMPTY_SLOT)
            .map(|&s| s as usize)
            .collect();

        if !equipped.is_empty() {
            let share = new_fees / equipped.len() as u64;
            let remainder = new_fees % equipped.len() as u64;
            for (i, card_id) in equipped.iter().enumerate() {
                let mut add = share;
                if i == 0 {
                    add = add.checked_add(remainder).ok_or(ForgeError::Overflow)?;
                }
                config.card_pools[*card_id] = config.card_pools[*card_id]
                    .checked_add(add)
                    .ok_or(ForgeError::Overflow)?;
            }
        }

        Ok(())
    }

    pub fn check_unlock(ctx: Context<CheckUnlock>) -> Result<()> {
        let config = &mut ctx.accounts.forge_config;
        require!(
            (config.cards_unlocked as usize) < NUM_CARD_TYPES,
            ForgeError::InvalidCardId
        );
        let next_threshold = (config.cards_unlocked as u64 + 1)
            .checked_mul(UNLOCK_THRESHOLD_LAMPORTS)
            .ok_or(ForgeError::Overflow)?;
        require!(
            config.total_fees_received >= next_threshold,
            ForgeError::UnlockThresholdNotMet
        );
        config.cards_unlocked += 1;
        Ok(())
    }

    pub fn start_vote(ctx: Context<StartVote>, slot_index: u8) -> Result<()> {
        let config = &ctx.accounts.forge_config;
        require!((slot_index as usize) < NUM_SLOTS, ForgeError::InvalidCardId);
        require!(
            config.slots[slot_index as usize] == EMPTY_SLOT,
            ForgeError::NoSlotsAvailable
        );
        let has_candidate = (0..config.cards_unlocked as usize)
            .any(|id| !config.card_equipped[id]);
        require!(has_candidate, ForgeError::CardNotUnlocked);

        let vote = &mut ctx.accounts.vote_state;
        vote.mint = config.mint;
        vote.slot_index = slot_index;
        vote.bump = ctx.bumps.vote_state;
        vote.is_open = true;
        vote.start_ts = Clock::get()?.unix_timestamp;
        vote.vote_counts = [0; NUM_CARD_TYPES];
        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, _slot_index: u8, card_id: u8) -> Result<()> {
        let config = &ctx.accounts.forge_config;
        let vote = &mut ctx.accounts.vote_state;
        require!(vote.is_open, ForgeError::VoteNotOpen);
        require!((card_id as usize) < NUM_CARD_TYPES, ForgeError::InvalidCardId);
        require!(
            (card_id as u8) < config.cards_unlocked,
            ForgeError::CardNotUnlocked
        );
        require!(
            !config.card_equipped[card_id as usize],
            ForgeError::CardAlreadyEquipped
        );

        vote.vote_counts[card_id as usize] += 1;
        ctx.accounts.vote_record.voted = true;
        Ok(())
    }

    pub fn finalize_vote(ctx: Context<FinalizeVote>, slot_index: u8) -> Result<()> {
        let vote = &mut ctx.accounts.vote_state;
        require!(vote.is_open, ForgeError::VoteNotOpen);
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= vote.start_ts + VOTE_WINDOW_SECS,
            ForgeError::VoteWindowNotElapsed
        );

        let config = &mut ctx.accounts.forge_config;
        let mut winner: Option<usize> = None;
        let mut best_votes: u32 = 0;
        for card_id in 0..config.cards_unlocked as usize {
            if config.card_equipped[card_id] {
                continue;
            }
            let votes = vote.vote_counts[card_id];
            if winner.is_none() || votes > best_votes {
                winner = Some(card_id);
                best_votes = votes;
            }
        }
        let winner = winner.ok_or(ForgeError::CardNotUnlocked)?;

        config.slots[slot_index as usize] = winner as u8;
        config.card_equipped[winner] = true;
        vote.is_open = false;
        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let config = &mut ctx.accounts.forge_config;
        let balance = ctx.accounts.holder_token_account.amount;
        require!(balance > 0, ForgeError::NotAHolder);

        let supply = ctx.accounts.mint.supply;
        require!(supply > 0, ForgeError::NothingToClaim);

        let pool = config.card_pools[CARD_REWARD as usize] as u128;
        let payout = (pool * balance as u128 / supply as u128) as u64;
        require!(payout > 0, ForgeError::NothingToClaim);

        config.card_pools[CARD_REWARD as usize] -= payout;
        config.total_withdrawn = config
            .total_withdrawn
            .checked_add(payout)
            .ok_or(ForgeError::Overflow)?;

        **config.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx
            .accounts
            .holder
            .to_account_info()
            .try_borrow_mut_lamports()? += payout;
        Ok(())
    }

    pub fn enter_jackpot(ctx: Context<EnterJackpot>) -> Result<()> {
        let config = &mut ctx.accounts.forge_config;
        require!(
            ctx.accounts.holder_token_account.amount > 0,
            ForgeError::NotAHolder
        );
        require!(
            config.jackpot_entrant_count < MAX_JACKPOT_ENTRANTS,
            ForgeError::JackpotFull
        );

        ctx.accounts.entry.wallet = ctx.accounts.holder.key();
        ctx.accounts.entry.round = config.jackpot_round;
        config.jackpot_entrant_count += 1;
        Ok(())
    }

    pub fn roll_winner(ctx: Context<RollWinner>) -> Result<()> {
        let config = &mut ctx.accounts.forge_config;
        let entrant_count = config.jackpot_entrant_count as usize;
        require!(entrant_count > 0, ForgeError::NoEntrants);

        let remaining = &ctx.remaining_accounts;
        require!(
            remaining.len() == entrant_count * 2,
            ForgeError::EntrantMismatch
        );

        for i in 0..entrant_count {
            let entry_info = &remaining[2 * i];
            let wallet_info = &remaining[2 * i + 1];
            let (expected_entry, _) = Pubkey::find_program_address(
                &[
                    b"forge-jackpot-entry",
                    config.mint.as_ref(),
                    &config.jackpot_round.to_le_bytes(),
                    wallet_info.key.as_ref(),
                ],
                ctx.program_id,
            );
            require_keys_eq!(expected_entry, *entry_info.key, ForgeError::EntrantMismatch);
        }

        let clock = Clock::get()?;
        let seed = (clock.unix_timestamp as u64)
            ^ clock.slot
            ^ config.jackpot_round
            ^ config.card_pools[CARD_JACKPOT as usize];
        let winner_index = (seed % entrant_count as u64) as usize;
        let winner_wallet_info = &remaining[2 * winner_index + 1];

        let payout = config.card_pools[CARD_JACKPOT as usize];
        require!(payout > 0, ForgeError::NothingToClaim);

        config.card_pools[CARD_JACKPOT as usize] = 0;
        config.total_withdrawn = config
            .total_withdrawn
            .checked_add(payout)
            .ok_or(ForgeError::Overflow)?;
        config.jackpot_round += 1;
        config.jackpot_entrant_count = 0;

        **config.to_account_info().try_borrow_mut_lamports()? -= payout;
        **winner_wallet_info.try_borrow_mut_lamports()? += payout;
        Ok(())
    }

    pub fn withdraw_for_buyback(ctx: Context<WithdrawForCard>, amount: u64) -> Result<()> {
        withdraw_for_card(&mut ctx.accounts.forge_config, CARD_BUYBACK, amount, &ctx.accounts.creator)
    }

    pub fn withdraw_for_burn(ctx: Context<WithdrawForCard>, amount: u64) -> Result<()> {
        withdraw_for_card(&mut ctx.accounts.forge_config, CARD_BURN, amount, &ctx.accounts.creator)
    }

    pub fn withdraw_for_lp(ctx: Context<WithdrawForCard>, amount: u64) -> Result<()> {
        withdraw_for_card(&mut ctx.accounts.forge_config, CARD_LP, amount, &ctx.accounts.creator)
    }

    pub fn sync_buyback_lock(ctx: Context<SyncBuybackLock>) -> Result<()> {
        ctx.accounts.forge_config.buyback_locked_tokens = ctx.accounts.token_account.amount;
        Ok(())
    }

    pub fn sync_lp_lock(ctx: Context<SyncLpLock>) -> Result<()> {
        ctx.accounts.forge_config.lp_locked_tokens = ctx.accounts.token_account.amount;
        Ok(())
    }

    pub fn execute_burn(ctx: Context<ExecuteBurn>) -> Result<()> {
        let amount = ctx.accounts.burn_token_account.amount;
        require!(amount > 0, ForgeError::NothingToClaim);

        let mint_key = ctx.accounts.mint.key();
        let bump = ctx.accounts.forge_config.bump;
        let seeds: &[&[u8]] = &[b"forge-config", mint_key.as_ref(), &[bump]];
        let signer: &[&[&[u8]]] = &[seeds];

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.burn_token_account.to_account_info(),
                    authority: ctx.accounts.forge_config.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.forge_config.burned_tokens = ctx
            .accounts
            .forge_config
            .burned_tokens
            .checked_add(amount)
            .ok_or(ForgeError::Overflow)?;
        Ok(())
    }
}

fn withdraw_for_card(
    config: &mut Account<ForgeConfig>,
    card_id: u8,
    amount: u64,
    creator: &Signer,
) -> Result<()> {
    require!(
        config.card_pools[card_id as usize] >= amount,
        ForgeError::InsufficientPool
    );
    config.card_pools[card_id as usize] -= amount;
    config.total_withdrawn = config
        .total_withdrawn
        .checked_add(amount)
        .ok_or(ForgeError::Overflow)?;

    **config.to_account_info().try_borrow_mut_lamports()? -= amount;
    **creator.to_account_info().try_borrow_mut_lamports()? += amount;
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        space = ForgeConfig::SIZE,
        seeds = [b"forge-config", mint.key().as_ref()],
        bump
    )]
    pub forge_config: Account<'info, ForgeConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SyncFees<'info> {
    #[account(mut, seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
}

#[derive(Accounts)]
pub struct CheckUnlock<'info> {
    #[account(mut, seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
}

#[derive(Accounts)]
#[instruction(slot_index: u8)]
pub struct StartVote<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(
        init,
        payer = payer,
        space = VoteState::SIZE,
        seeds = [b"forge-vote", forge_config.mint.as_ref(), &[slot_index]],
        bump
    )]
    pub vote_state: Account<'info, VoteState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(slot_index: u8, card_id: u8)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(
        mut,
        seeds = [b"forge-vote", forge_config.mint.as_ref(), &[slot_index]],
        bump = vote_state.bump
    )]
    pub vote_state: Account<'info, VoteState>,
    #[account(
        init,
        payer = voter,
        space = VoteRecord::SIZE,
        seeds = [b"forge-vote-record", vote_state.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(slot_index: u8)]
pub struct FinalizeVote<'info> {
    #[account(mut, seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(
        mut,
        seeds = [b"forge-vote", forge_config.mint.as_ref(), &[slot_index]],
        bump = vote_state.bump
    )]
    pub vote_state: Account<'info, VoteState>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,
    #[account(mut, seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(constraint = mint.key() == forge_config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(token::mint = mint, token::authority = holder)]
    pub holder_token_account: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct EnterJackpot<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,
    #[account(mut, seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(constraint = mint.key() == forge_config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(token::mint = mint, token::authority = holder)]
    pub holder_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = holder,
        space = JackpotEntry::SIZE,
        seeds = [
            b"forge-jackpot-entry",
            forge_config.mint.as_ref(),
            &forge_config.jackpot_round.to_le_bytes(),
            holder.key().as_ref()
        ],
        bump
    )]
    pub entry: Account<'info, JackpotEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RollWinner<'info> {
    #[account(mut, has_one = creator)]
    pub forge_config: Account<'info, ForgeConfig>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawForCard<'info> {
    #[account(mut, has_one = creator)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct SyncBuybackLock<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(constraint = mint.key() == forge_config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"forge-buyback-vault", forge_config.mint.as_ref()],
        bump,
        token::mint = mint,
        token::authority = forge_config
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SyncLpLock<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(constraint = mint.key() == forge_config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"forge-lp-vault", forge_config.mint.as_ref()],
        bump,
        token::mint = mint,
        token::authority = forge_config
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteBurn<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"forge-config", forge_config.mint.as_ref()], bump = forge_config.bump)]
    pub forge_config: Account<'info, ForgeConfig>,
    #[account(mut, constraint = mint.key() == forge_config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"forge-burn-vault", forge_config.mint.as_ref()],
        bump,
        token::mint = mint,
        token::authority = forge_config
    )]
    pub burn_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
