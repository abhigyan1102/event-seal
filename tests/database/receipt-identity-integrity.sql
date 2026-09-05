\set ON_ERROR_STOP on

-- Run only against an isolated, empty test database as a superuser:
-- psql -X --dbname eventseal_test --file tests/database/receipt-identity-integrity.sql
begin;

create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;

\ir ../../migrations/20260721000000_create-verification-receipts.sql
\ir ../../migrations/20260904192157_add-receipt-identity-integrity.sql
\ir ../../migrations/20260905041246_validate-receipt-identity-constraints.sql

insert into public.verification_receipts
  (receipt_id, signature, cluster, verdict, reason_code)
values ('legacy-receipt', 'legacy-signature', 'devnet', 'verified', 'VERIFIED');

insert into public.verification_receipts (
  receipt_version,
  receipt_id,
  signature,
  cluster,
  commitment,
  slot,
  verdict,
  reason_code,
  reason,
  expected_program_id,
  event_format,
  event_discriminator,
  emitter_program_id,
  event_position,
  event_data_hash,
  evidence
) values (
  2,
  'v2-receipt',
  'v2-signature',
  'devnet',
  'finalized',
  42,
  'verified',
  'VERIFIED',
  'The finalized transaction emitted the expected event',
  'expected-program',
  'anchor-log',
  '0123456789abcdef',
  'expected-program',
  0,
  repeat('a', 64),
  '[{"check":"transaction-status","passed":true,"detail":"Transaction succeeded"}]'::jsonb
);

do $$
declare
  mutation_sql text;
begin
  if (
    select count(*) <> 2 or coalesce(bool_or(not convalidated), true)
    from pg_constraint
    where conrelid = 'public.verification_receipts'::regclass
      and conname in (
        'verification_receipts_version_check',
        'verification_receipts_identity_check'
      )
  ) then
    raise exception 'Receipt identity constraints were not validated';
  end if;

  if not exists (
    select 1
    from public.verification_receipts
    where receipt_id = 'legacy-receipt'
      and receipt_version = 1
      and commitment is null
      and expected_program_id is null
  ) then
    raise exception 'Existing receipt compatibility was not preserved';
  end if;

  if not exists (
    select 1
    from public.verification_receipts
    where receipt_id = 'v2-receipt'
      and receipt_version = 2
      and commitment = 'finalized'
      and expected_program_id = 'expected-program'
      and event_format = 'anchor-log'
      and event_discriminator = '0123456789abcdef'
  ) then
    raise exception 'Complete v2 identity was not persisted';
  end if;

  -- Insert-only retries must preserve the first immutable receipt.
  insert into public.verification_receipts (
    receipt_version,
    receipt_id,
    signature,
    cluster,
    commitment,
    verdict,
    reason_code,
    reason,
    expected_program_id,
    event_format,
    event_discriminator,
    emitter_program_id,
    event_position,
    event_data_hash
  ) values (
    2,
    'v2-receipt',
    'conflicting-signature',
    'devnet',
    'finalized',
    'rejected',
    'PROGRAM_MISMATCH',
    'conflict',
    'other-program',
    'anchor-log',
    'fedcba9876543210',
    'other-program',
    1,
    repeat('b', 64)
  ) on conflict (receipt_id) do nothing;

  if (select signature from public.verification_receipts where receipt_id = 'v2-receipt') <> 'v2-signature' then
    raise exception 'Duplicate insert changed an immutable receipt';
  end if;

  foreach mutation_sql in array array[
    'update public.verification_receipts set verdict = ''rejected'' where receipt_id = ''v2-receipt''',
    'delete from public.verification_receipts where receipt_id = ''v2-receipt'''
  ] loop
    begin
      execute mutation_sql;
      raise exception 'Receipt mutation unexpectedly succeeded: %', mutation_sql;
    exception when sqlstate '55000' then
      null;
    end;
  end loop;

  begin
    insert into public.verification_receipts (
      receipt_version,
      receipt_id,
      signature,
      cluster,
      commitment,
      verdict,
      reason_code,
      reason,
      expected_program_id,
      event_format,
      event_discriminator,
      emitter_program_id,
      event_position,
      event_data_hash
    ) values (
      2,
      'incomplete-v2',
      'incomplete-signature',
      'devnet',
      'finalized',
      'verified',
      'VERIFIED',
      'missing trusted discriminator',
      'expected-program',
      'anchor-log',
      null,
      'expected-program',
      0,
      repeat('c', 64)
    );
    raise exception 'Incomplete v2 receipt unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
end;
$$;

set local role anon;

do $$
declare
  forbidden_sql text;
begin
  if (select count(*) from public.verification_receipts) <> 2 then
    raise exception 'Public receipt reads are unavailable';
  end if;

  foreach forbidden_sql in array array[
    'insert into public.verification_receipts (receipt_version, receipt_id, signature, cluster, verdict, reason_code) values (1, ''anon-insert'', ''signature'', ''devnet'', ''verified'', ''VERIFIED'')',
    'update public.verification_receipts set verdict = ''rejected''',
    'delete from public.verification_receipts'
  ] loop
    begin
      execute forbidden_sql;
      raise exception 'Anonymous receipt mutation unexpectedly succeeded: %', forbidden_sql;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
end;
$$;

rollback;
