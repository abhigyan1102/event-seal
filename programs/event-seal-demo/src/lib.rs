use anchor_lang::prelude::*;

declare_id!("AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS");

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

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::Discriminator;

    #[test]
    fn exposes_stable_devnet_identity() {
        assert_eq!(
            ID.to_string(),
            "AMWm3XHjn6zVygWDX6J7DYPvvwQ6xy3mKKwspWJeuZVS",
        );
        assert_eq!(
            DemoEvent::DISCRIMINATOR,
            &[0xbf, 0x91, 0xff, 0x47, 0xac, 0x4c, 0xb1, 0x87]
        );
    }

    #[test]
    fn emit_then_fail_returns_deliberate_error() {
        let mut accounts = EmitDemoEvent {};
        let ctx = Context::new(&ID, &mut accounts, &[], EmitDemoEventBumps {});

        let error = event_seal_demo::emit_then_fail(ctx, 42).unwrap_err();

        assert_eq!(error, error!(DemoError::DeliberateFailure));
    }
}
