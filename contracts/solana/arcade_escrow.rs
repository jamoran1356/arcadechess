use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod arcade_escrow {
    use super::*;

    // Status constants
    pub const STATUS_OPEN: u8 = 0;
    pub const STATUS_IN_PROGRESS: u8 = 1;
    pub const STATUS_SETTLED: u8 = 2;
    pub const STATUS_CANCELLED: u8 = 3;

    /// Create a new match escrow
    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: String,
        stake_amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;
        escrow.host = ctx.accounts.host.key();
        escrow.guest = None;
        escrow.stake_amount = stake_amount;
        escrow.total_pool = stake_amount;
        escrow.status = STATUS_OPEN;
        escrow.settled_at = 0;
        escrow.winner = None;
        escrow.match_id = match_id;

        emit!(MatchCreated {
            match_id: escrow.match_id.clone(),
            host: escrow.host,
            stake_amount: stake_amount,
        });

        Ok(())
    }

    /// Join an existing match
    pub fn join_match(
        ctx: Context<JoinMatch>,
        stake_amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;
        
        require!(escrow.status == STATUS_OPEN, ErrorCode::MatchNotOpen);
        require!(escrow.guest.is_none(), ErrorCode::GuestAlreadySet);
        require!(stake_amount == escrow.stake_amount, ErrorCode::InvalidStakeAmount);

        escrow.guest = Some(ctx.accounts.guest.key());
        escrow.total_pool = escrow.total_pool + stake_amount;
        escrow.status = STATUS_IN_PROGRESS;

        emit!(MatchJoined {
            match_id: escrow.match_id.clone(),
            guest: ctx.accounts.guest.key(),
        });

        Ok(())
    }

    /// Settle a match and assign winner
    pub fn settle_match(
        ctx: Context<SettleMatch>,
        winner: Pubkey,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;

        require!(escrow.status == STATUS_IN_PROGRESS, ErrorCode::MatchNotInProgress);

        escrow.status = STATUS_SETTLED;
        escrow.winner = Some(winner);
        escrow.settled_at = Clock::get()?.unix_timestamp as u64;

        emit!(MatchSettled {
            match_id: escrow.match_id.clone(),
            winner,
            prize_amount: escrow.total_pool,
        });

        Ok(())
    }

    /// Cancel a match
    pub fn cancel_match(
        ctx: Context<CancelMatch>,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.match_escrow;
        escrow.status = STATUS_CANCELLED;

        emit!(MatchCancelled {
            match_id: escrow.match_id.clone(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct CreateMatch<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        init,
        payer = host,
        space = 8 + MatchEscrow::INIT_SPACE,
        seeds = [b"match", match_id.as_bytes()],
        bump
    )]
    pub match_escrow: Account<'info, MatchEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(mut)]
    pub guest: Signer<'info>,
    #[account(mut)]
    pub match_escrow: Account<'info, MatchEscrow>,
}

#[derive(Accounts)]
pub struct SettleMatch<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub match_escrow: Account<'info, MatchEscrow>,
}

#[derive(Accounts)]
pub struct CancelMatch<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub match_escrow: Account<'info, MatchEscrow>,
}

#[account]
pub struct MatchEscrow {
    pub host: Pubkey,
    pub guest: Option<Pubkey>,
    pub stake_amount: u64,
    pub total_pool: u64,
    pub status: u8,
    pub settled_at: u64,
    pub winner: Option<Pubkey>,
    pub match_id: String,
}

impl MatchEscrow {
    pub const INIT_SPACE: usize = 32 + 33 + 8 + 8 + 1 + 8 + 33 + 50; // Approximate space
}

#[event]
pub struct MatchCreated {
    pub match_id: String,
    pub host: Pubkey,
    pub stake_amount: u64,
}

#[event]
pub struct MatchJoined {
    pub match_id: String,
    pub guest: Pubkey,
}

#[event]
pub struct MatchSettled {
    pub match_id: String,
    pub winner: Pubkey,
    pub prize_amount: u64,
}

#[event]
pub struct MatchCancelled {
    pub match_id: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Match not open")]
    MatchNotOpen,
    #[msg("Guest already set")]
    GuestAlreadySet,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Match not in progress")]
    MatchNotInProgress,
}