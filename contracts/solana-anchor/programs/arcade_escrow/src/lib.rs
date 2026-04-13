use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("PMCjtbjN15YvMxPoXdsrmr35RRDV5W5ASVdVEbF6PX6");

/// Seed for the vault PDA that custodies all match/bet SOL.
pub const VAULT_SEED: &[u8] = b"vault";

#[program]
pub mod arcade_escrow {
    use super::*;

    pub const STATUS_OPEN: u8 = 0;
    pub const STATUS_FUNDED: u8 = 1;
    pub const STATUS_SETTLED: u8 = 2;
    pub const STATUS_CANCELLED: u8 = 3;
    pub const STATUS_DRAW: u8 = 4;
    pub const BET_STATUS_OPEN: u8 = 10;
    pub const BET_STATUS_WON: u8 = 11;
    pub const BET_STATUS_LOST: u8 = 12;

    /// Initialize the global vault PDA (one-time setup).
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.admin = ctx.accounts.admin.key();
        vault.match_count = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    /// Create a new match escrow. Admin deposits host's stake from the admin wallet.
    pub fn create_match(
        ctx: Context<CreateMatch>,
        host: Pubkey,
        stake_per_player: u64,
        entry_fee: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let match_index = vault.match_count;
        vault.match_count += 1;

        let escrow = &mut ctx.accounts.match_escrow;
        escrow.match_index = match_index;
        escrow.host = host;
        escrow.guest = Pubkey::default();
        escrow.stake_per_player = stake_per_player;
        escrow.entry_fee = entry_fee;
        escrow.host_deposited = 0;
        escrow.guest_deposited = 0;
        escrow.status = STATUS_OPEN;
        escrow.settled_at = 0;
        escrow.winner = Pubkey::default();
        escrow.bump = ctx.bumps.match_escrow;

        emit!(MatchCreated {
            match_index,
            host,
            stake_per_player,
            entry_fee,
        });

        Ok(())
    }

    /// Admin deposits SOL into the vault on behalf of a player.
    /// When both host and guest have deposited, status moves to FUNDED.
    pub fn deposit_funds(
        ctx: Context<DepositFunds>,
        _match_index: u64,
        player: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;

        require!(
            escrow.status == STATUS_OPEN || escrow.status == STATUS_FUNDED,
            ErrorCode::MatchNotOpen
        );

        // Transfer SOL from admin to vault PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.admin.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        if player == escrow.host {
            escrow.host_deposited += amount;
        } else {
            // First deposit from a guest sets the guest address
            if escrow.guest == Pubkey::default() {
                escrow.guest = player;
            }
            require!(player == escrow.guest, ErrorCode::InvalidPlayer);
            escrow.guest_deposited += amount;
        }

        // Auto-advance to FUNDED when both sides deposited
        if escrow.host_deposited > 0 && escrow.guest_deposited > 0 {
            escrow.status = STATUS_FUNDED;
        }

        emit!(FundsDeposited {
            match_index: escrow.match_index,
            player,
            amount,
        });

        Ok(())
    }

    /// Settle match: transfer prize SOL from vault to the winner.
    pub fn settle_to_winner(
        ctx: Context<SettleToWinner>,
        _match_index: u64,
        winner: Pubkey,
        prize_amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;

        require!(escrow.status == STATUS_FUNDED, ErrorCode::MatchNotFunded);
        require!(
            winner == escrow.host || winner == escrow.guest,
            ErrorCode::InvalidWinner
        );

        let pool = escrow.host_deposited + escrow.guest_deposited;
        require!(prize_amount <= pool, ErrorCode::InsufficientPool);

        // Transfer SOL from vault PDA to winner
        let vault = &ctx.accounts.vault;
        let bump = vault.bump;
        let seeds: &[&[u8]] = &[VAULT_SEED, &[bump]];
        let signer_seeds = &[seeds];

        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= prize_amount;
        **ctx.accounts.winner_account.to_account_info().try_borrow_mut_lamports()? += prize_amount;

        escrow.status = STATUS_SETTLED;
        escrow.winner = winner;
        escrow.settled_at = Clock::get()?.unix_timestamp as u64;

        emit!(WinnerPaid {
            match_index: escrow.match_index,
            winner,
            prize_amount,
            timestamp: escrow.settled_at,
        });

        // Suppress unused-variable warning for signer_seeds (kept for future CPI use)
        let _ = signer_seeds;

        Ok(())
    }

    /// Draw: refund both players their deposits from the vault.
    pub fn settle_draw(ctx: Context<SettleDraw>, _match_index: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;

        require!(escrow.status == STATUS_FUNDED, ErrorCode::MatchNotFunded);

        let vault = &ctx.accounts.vault;
        let bump = vault.bump;
        let seeds: &[&[u8]] = &[VAULT_SEED, &[bump]];
        let signer_seeds = &[seeds];

        let host_refund = escrow.host_deposited;
        let guest_refund = escrow.guest_deposited;

        if host_refund > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= host_refund;
            **ctx.accounts.host_account.to_account_info().try_borrow_mut_lamports()? += host_refund;

            emit!(FundsRefunded {
                match_index: escrow.match_index,
                player: escrow.host,
                amount: host_refund,
            });
        }

        if guest_refund > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= guest_refund;
            **ctx.accounts.guest_account.to_account_info().try_borrow_mut_lamports()? += guest_refund;

            emit!(FundsRefunded {
                match_index: escrow.match_index,
                player: escrow.guest,
                amount: guest_refund,
            });
        }

        escrow.status = STATUS_DRAW;
        escrow.settled_at = Clock::get()?.unix_timestamp as u64;

        let _ = signer_seeds;

        Ok(())
    }

    /// Cancel/refund: return all deposits. Only works for OPEN or FUNDED matches.
    pub fn refund_match(ctx: Context<RefundMatch>, _match_index: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;

        require!(
            escrow.status == STATUS_OPEN || escrow.status == STATUS_FUNDED,
            ErrorCode::MatchNotRefundable
        );

        let vault = &ctx.accounts.vault;
        let bump = vault.bump;
        let seeds: &[&[u8]] = &[VAULT_SEED, &[bump]];
        let signer_seeds = &[seeds];

        let host_refund = escrow.host_deposited;
        let guest_refund = escrow.guest_deposited;

        if host_refund > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= host_refund;
            **ctx.accounts.host_account.to_account_info().try_borrow_mut_lamports()? += host_refund;

            emit!(FundsRefunded {
                match_index: escrow.match_index,
                player: escrow.host,
                amount: host_refund,
            });
        }

        if guest_refund > 0 && escrow.guest != Pubkey::default() {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= guest_refund;
            **ctx.accounts.guest_account.to_account_info().try_borrow_mut_lamports()? += guest_refund;

            emit!(FundsRefunded {
                match_index: escrow.match_index,
                player: escrow.guest,
                amount: guest_refund,
            });
        }

        escrow.status = STATUS_CANCELLED;

        emit!(MatchCancelled {
            match_index: escrow.match_index,
        });

        let _ = signer_seeds;

        Ok(())
    }

    /// Place a bet: bettor sends SOL to vault.
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        match_id: String,
        predicted_winner: Pubkey,
        amount: u64,
    ) -> Result<()> {
        // Transfer SOL from bettor (via admin) to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.admin.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        let bet = &mut ctx.accounts.bet_escrow;
        bet.match_id = match_id.clone();
        bet.bettor = ctx.accounts.bettor.key();
        bet.predicted_winner = predicted_winner;
        bet.amount = amount;
        bet.payout_amount = 0;
        bet.status = BET_STATUS_OPEN;
        bet.settled_at = 0;

        emit!(BetPlaced {
            match_id,
            bettor: bet.bettor,
            predicted_winner,
            amount,
        });

        Ok(())
    }

    /// Settle bet: pay out winning bets from vault.
    pub fn settle_bet(
        ctx: Context<SettleBet>,
        winner: Pubkey,
        payout_amount: u64,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet_escrow;
        require!(bet.status == BET_STATUS_OPEN, ErrorCode::BetNotOpen);

        if bet.predicted_winner == winner {
            bet.status = BET_STATUS_WON;
            bet.payout_amount = payout_amount;

            // Pay out from vault to bettor
            if payout_amount > 0 {
                **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= payout_amount;
                **ctx.accounts.bettor_account.to_account_info().try_borrow_mut_lamports()? += payout_amount;
            }
        } else {
            bet.status = BET_STATUS_LOST;
            bet.payout_amount = 0;
        }
        bet.settled_at = Clock::get()?.unix_timestamp as u64;

        emit!(BetSettled {
            match_id: bet.match_id.clone(),
            bettor: bet.bettor,
            winner,
            payout_amount: bet.payout_amount,
            status: bet.status,
        });

        Ok(())
    }
}

// ─── Account Contexts ──────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMatch<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = admin,
        space = 8 + MatchEscrow::INIT_SPACE,
        seeds = [b"match", vault.match_count.to_le_bytes().as_ref()],
        bump
    )]
    pub match_escrow: Account<'info, MatchEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_match_index: u64)]
pub struct DepositFunds<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    /// CHECK: vault PDA receives SOL
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"match", _match_index.to_le_bytes().as_ref()],
        bump = match_escrow.bump,
    )]
    pub match_escrow: Account<'info, MatchEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_match_index: u64)]
pub struct SettleToWinner<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    /// CHECK: vault PDA sends SOL
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"match", _match_index.to_le_bytes().as_ref()],
        bump = match_escrow.bump,
    )]
    pub match_escrow: Account<'info, MatchEscrow>,
    /// CHECK: winner receives SOL, validated in handler
    #[account(mut)]
    pub winner_account: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(_match_index: u64)]
pub struct SettleDraw<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    /// CHECK: vault PDA sends SOL
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"match", _match_index.to_le_bytes().as_ref()],
        bump = match_escrow.bump,
    )]
    pub match_escrow: Account<'info, MatchEscrow>,
    /// CHECK: host receives refund
    #[account(mut)]
    pub host_account: AccountInfo<'info>,
    /// CHECK: guest receives refund
    #[account(mut)]
    pub guest_account: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(_match_index: u64)]
pub struct RefundMatch<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    /// CHECK: vault PDA sends SOL
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"match", _match_index.to_le_bytes().as_ref()],
        bump = match_escrow.bump,
    )]
    pub match_escrow: Account<'info, MatchEscrow>,
    /// CHECK: host receives refund
    #[account(mut)]
    pub host_account: AccountInfo<'info>,
    /// CHECK: guest receives refund (may be default/zeroed if no guest)
    #[account(mut)]
    pub guest_account: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct PlaceBet<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    /// CHECK: bettor identity (not necessarily signer in admin-custody model)
    pub bettor: AccountInfo<'info>,
    /// CHECK: vault PDA receives SOL
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = admin,
        space = 8 + BetEscrow::INIT_SPACE,
        seeds = [b"bet", match_id.as_bytes(), bettor.key().as_ref()],
        bump
    )]
    pub bet_escrow: Account<'info, BetEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleBet<'info> {
    #[account(mut, constraint = admin.key() == vault.admin @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    /// CHECK: vault PDA sends SOL for payout
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub bet_escrow: Account<'info, BetEscrow>,
    /// CHECK: bettor receives payout
    #[account(mut)]
    pub bettor_account: AccountInfo<'info>,
}

// ─── State Accounts ───────────────────────────────────────────────────────

#[account]
pub struct Vault {
    pub admin: Pubkey,
    pub match_count: u64,
    pub bump: u8,
}

impl Vault {
    pub const INIT_SPACE: usize = 32 + 8 + 1;
}

#[account]
pub struct MatchEscrow {
    pub match_index: u64,
    pub host: Pubkey,
    pub guest: Pubkey,
    pub stake_per_player: u64,
    pub entry_fee: u64,
    pub host_deposited: u64,
    pub guest_deposited: u64,
    pub status: u8,
    pub settled_at: u64,
    pub winner: Pubkey,
    pub bump: u8,
}

impl MatchEscrow {
    // 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 32 + 1 = 146
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 32 + 1;
}

#[account]
pub struct BetEscrow {
    pub match_id: String,
    pub bettor: Pubkey,
    pub predicted_winner: Pubkey,
    pub amount: u64,
    pub payout_amount: u64,
    pub status: u8,
    pub settled_at: u64,
}

impl BetEscrow {
    // 4+50 + 32 + 32 + 8 + 8 + 1 + 8 = 143
    pub const INIT_SPACE: usize = 54 + 32 + 32 + 8 + 8 + 1 + 8;
}

// ─── Events ─────────────────────────────────────────────────────────────

#[event]
pub struct MatchCreated {
    pub match_index: u64,
    pub host: Pubkey,
    pub stake_per_player: u64,
    pub entry_fee: u64,
}

#[event]
pub struct FundsDeposited {
    pub match_index: u64,
    pub player: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WinnerPaid {
    pub match_index: u64,
    pub winner: Pubkey,
    pub prize_amount: u64,
    pub timestamp: u64,
}

#[event]
pub struct FundsRefunded {
    pub match_index: u64,
    pub player: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MatchCancelled {
    pub match_index: u64,
}

#[event]
pub struct BetPlaced {
    pub match_id: String,
    pub bettor: Pubkey,
    pub predicted_winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BetSettled {
    pub match_id: String,
    pub bettor: Pubkey,
    pub winner: Pubkey,
    pub payout_amount: u64,
    pub status: u8,
}

// ─── Errors ──────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,
    #[msg("Match not open")]
    MatchNotOpen,
    #[msg("Match not funded")]
    MatchNotFunded,
    #[msg("Match not refundable (must be OPEN or FUNDED)")]
    MatchNotRefundable,
    #[msg("Invalid player address")]
    InvalidPlayer,
    #[msg("Invalid winner: must be host or guest")]
    InvalidWinner,
    #[msg("Prize amount exceeds pool")]
    InsufficientPool,
    #[msg("Guest already set")]
    GuestAlreadySet,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Match not in progress")]
    MatchNotInProgress,
    #[msg("Bet not open")]
    BetNotOpen,
}
