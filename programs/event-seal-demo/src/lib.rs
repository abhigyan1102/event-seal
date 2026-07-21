use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWxqSWYbe2y1yVt9xEoBNHZsXcyB");

#[program]
pub mod event_seal_demo {
    use super::*;

    pub fn emit_success(_ctx: Context<EmitDemoEvent>, nonce: u64) -> Result<()> {
        emit!(DemoEvent { nonce });
        Ok(())
    }

    pub fn emit_then_fail(_ctx: Context<EmitDemoEvent>, nonce: u64) -> Result<()> {
        emit!(DemoEvent { nonce });
        err!(DemoError::DeliberateFailure)
    }
}

#[derive(Accounts)]
pub struct EmitDemoEvent {}

#[event]
pub struct DemoEvent {
    pub nonce: u64,
}

#[error_code]
pub enum DemoError {
    #[msg("The transaction failed deliberately after emitting its event.")]
    DeliberateFailure,
}

