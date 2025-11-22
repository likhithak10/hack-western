use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("NativeLoader1111111111111111111111111111111");

#[program]
pub mod focus_royale {
    use super::*;

    /// Initialize a new escrow account for a user's focus session
    /// PDA: ["escrow", user_pubkey]
    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, stake_amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.user = ctx.accounts.user.key();
        escrow.stake_amount = stake_amount;
        escrow.focus_score = 0;
        escrow.completed = false;
        escrow.bump = ctx.bumps.escrow;
        
        msg!("Escrow initialized for user: {}", escrow.user);
        msg!("Stake amount: {} lamports", stake_amount);
        Ok(())
    }

    /// Deposit SOL stake into the escrow PDA
    /// Transfers SOL from user wallet to escrow account
    pub fn deposit_stake(ctx: Context<DepositStake>, amount: u64) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        // Verify the escrow belongs to the user
        require!(
            escrow.user == ctx.accounts.user.key(),
            ErrorCode::UnauthorizedUser
        );

        // Transfer SOL from user to escrow PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        msg!("Deposited {} lamports to escrow", amount);
        Ok(())
    }

    /// Update focus score for a user's session
    /// Can be called multiple times to update the score
    pub fn update_focus_score(ctx: Context<UpdateFocusScore>, new_score: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(
            escrow.user == ctx.accounts.user.key(),
            ErrorCode::UnauthorizedUser
        );

        // Update score if new score is higher
        if new_score > escrow.focus_score {
            escrow.focus_score = new_score;
            msg!("Focus score updated to: {}", new_score);
        }

        Ok(())
    }

    /// Complete the session and mark as eligible for reward
    pub fn complete_session(ctx: Context<CompleteSession>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(
            escrow.user == ctx.accounts.user.key(),
            ErrorCode::UnauthorizedUser
        );

        escrow.completed = true;
        msg!("Session completed for user: {}", escrow.user);
        Ok(())
    }

    /// Claim reward - winner gets their stake back + bonus from penalty pool
    /// Only callable if completed = true
    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        require!(
            escrow.user == ctx.accounts.user.key(),
            ErrorCode::UnauthorizedUser
        );
        require!(
            escrow.completed,
            ErrorCode::SessionNotCompleted
        );

        let stake_amount = escrow.stake_amount;
        
        // Transfer stake back to user
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= stake_amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += stake_amount;

        // Transfer any bonus from penalty pool if available
        let penalty_pool_balance = ctx.accounts.penalty_pool.to_account_info().lamports();
        if penalty_pool_balance > 0 {
            let bonus = penalty_pool_balance / 2; // 50% of penalty pool as bonus
            **ctx.accounts.penalty_pool.to_account_info().try_borrow_mut_lamports()? -= bonus;
            **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += bonus;
            msg!("Bonus reward: {} lamports", bonus);
        }

        msg!("Reward claimed: {} lamports", stake_amount);
        Ok(())
    }

    /// Forfeit stake - sends escrowed SOL to penalty pool
    /// Called when user fails/quits early
    pub fn forfeit_stake(ctx: Context<ForfeitStake>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        require!(
            escrow.user == ctx.accounts.user.key(),
            ErrorCode::UnauthorizedUser
        );

        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        
        // Transfer all SOL from escrow to penalty pool
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= escrow_balance;
        **ctx.accounts.penalty_pool.to_account_info().try_borrow_mut_lamports()? += escrow_balance;

        msg!("Forfeited {} lamports to penalty pool", escrow_balance);
        Ok(())
    }
}

// Account Structures

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Escrow::LEN,
        seeds = [b"escrow", user.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositStake<'info> {
    #[account(
        mut,
        seeds = [b"escrow", user.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFocusScore<'info> {
    #[account(
        mut,
        seeds = [b"escrow", user.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteSession<'info> {
    #[account(
        mut,
        seeds = [b"escrow", user.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(
        mut,
        seeds = [b"escrow", user.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Penalty pool PDA - collects forfeited stakes
    #[account(
        mut,
        seeds = [b"penalty_pool"],
        bump
    )]
    pub penalty_pool: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct ForfeitStake<'info> {
    #[account(
        mut,
        seeds = [b"escrow", user.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    /// Penalty pool PDA - collects forfeited stakes
    #[account(
        mut,
        seeds = [b"penalty_pool"],
        bump
    )]
    pub penalty_pool: SystemAccount<'info>,
    
    pub user: Signer<'info>,
}

// Data Structures

#[account]
pub struct Escrow {
    pub user: Pubkey,           // 32 bytes
    pub stake_amount: u64,      // 8 bytes
    pub focus_score: u64,       // 8 bytes
    pub completed: bool,        // 1 byte
    pub bump: u8,               // 1 byte
}

impl Escrow {
    pub const LEN: usize = 32 + 8 + 8 + 1 + 1;
}

// Error Codes

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized user")]
    UnauthorizedUser,
    #[msg("Session not completed")]
    SessionNotCompleted,
}

