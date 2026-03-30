use anchor_lang::prelude::*;

declare_id!("9w7QUjQ9WPTr3BvwAceR2hbCJPNEeeQrTG5LVdE6RE1o");

#[program]
pub mod arcade_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
