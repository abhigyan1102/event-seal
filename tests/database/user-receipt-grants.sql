\set ON_ERROR_STOP on

-- Run only against an isolated, empty test database as a superuser:
-- psql -X --dbname eventseal_test --file tests/database/user-receipt-grants.sql
begin;

create role anon nologin;
create role authenticated nologin;

-- Minimal auth fixture; real InsForge auth objects are never modified.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated;

\ir ../../migrations/20260721000000_create-verification-receipts.sql
\ir ../../migrations/20260827073314_create-user-receipts.sql
\ir ../../migrations/20260827091618_restrict-user-receipts-to-save-list.sql
\ir ../../migrations/20260827165427_restrict-user-receipt-insert-columns.sql

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.verification_receipts
  (receipt_id, signature, cluster, verdict, reason_code)
values ('test-receipt', 'test-signature', 'devnet', 'verified', 'VERIFIED');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

do $$
declare
  forbidden_sql text;
begin
  -- Reject direct client writes even when bypassing the web save action.
  foreach forbidden_sql in array array[
    'insert into public.user_receipts (receipt_id, saved_at) values (''test-receipt'', ''2000-01-01T00:00:00Z'')',
    'insert into public.user_receipts (receipt_id, saved_at) values (''test-receipt'', ''2099-01-01T00:00:00Z'')',
    'insert into public.user_receipts (receipt_id, user_id) values (''test-receipt'', auth.uid())',
    'insert into public.user_receipts (receipt_id, user_id) values (''test-receipt'', ''00000000-0000-0000-0000-000000000002'')'
  ] loop
    begin
      execute forbidden_sql;
      raise exception 'Protected insert unexpectedly succeeded: %', forbidden_sql;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  -- Match saveReceipt: only receipt_id, with duplicate saves ignored.
  insert into public.user_receipts (receipt_id) values ('test-receipt')
    on conflict (user_id, receipt_id) do nothing;
  insert into public.user_receipts (receipt_id) values ('test-receipt')
    on conflict (user_id, receipt_id) do nothing;

  if (select count(*) from public.user_receipts) <> 1 then
    raise exception 'Save/list or duplicate handling failed';
  end if;
  if not exists (
    select 1 from public.user_receipts
    where receipt_id = 'test-receipt'
      and user_id = auth.uid() and saved_at = now()
  ) then
    raise exception 'Database ownership/timestamp defaults were not preserved';
  end if;

  -- Preserve the current save/list-only surface.
  foreach forbidden_sql in array array[
    'update public.user_receipts set saved_at = ''2099-01-01T00:00:00Z''',
    'delete from public.user_receipts'
  ] loop
    begin
      execute forbidden_sql;
      raise exception 'Forbidden mutation unexpectedly succeeded: %', forbidden_sql;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
end;
$$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
begin
  if exists (select 1 from public.user_receipts) then
    raise exception 'Another account can read the saved reference';
  end if;
  insert into public.user_receipts (receipt_id) values ('test-receipt')
    on conflict (user_id, receipt_id) do nothing;
  if (select count(*) from public.user_receipts) <> 1 then
    raise exception 'Another account cannot independently save the same receipt';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claim.sub = '';
do $$
declare
  forbidden_sql text;
begin
  foreach forbidden_sql in array array[
    'select * from public.user_receipts',
    'insert into public.user_receipts (receipt_id) values (''test-receipt'')'
  ] loop
    begin
      execute forbidden_sql;
      raise exception 'Anonymous access unexpectedly succeeded: %', forbidden_sql;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
end;
$$;

rollback;
