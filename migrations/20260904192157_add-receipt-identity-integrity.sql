alter table public.verification_receipts
  add column receipt_version smallint not null default 1,
  add column commitment text,
  add column reason text,
  add column expected_program_id text,
  add column event_format text,
  add column event_discriminator text;

-- Rows created before this migration remain valid v1 receipts. New writers must
-- explicitly persist the complete v2 verification identity.
alter table public.verification_receipts
  alter column receipt_version set default 2;

alter table public.verification_receipts
  add constraint verification_receipts_version_check
    check (receipt_version in (1, 2)),
  add constraint verification_receipts_identity_check
    check (
      (
        receipt_version = 1
        and commitment is null
        and reason is null
        and expected_program_id is null
        and event_format is null
        and event_discriminator is null
      )
      or
      (
        receipt_version = 2
        and commitment = 'finalized'
        and length(btrim(reason)) > 0
        and length(btrim(expected_program_id)) > 0
        and event_format in ('anchor-log', 'anchor-cpi')
        and event_discriminator ~ '^[0-9a-f]{16}$'
        and length(btrim(emitter_program_id)) > 0
        and event_position >= 0
        and event_data_hash ~ '^[0-9a-f]{64}$'
      )
    );

create function public.reject_verification_receipt_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'verification receipts are immutable'
    using errcode = '55000';
end;
$$;

revoke all on function public.reject_verification_receipt_mutation() from public;

create trigger verification_receipts_are_immutable
before update or delete on public.verification_receipts
for each row execute function public.reject_verification_receipt_mutation();
