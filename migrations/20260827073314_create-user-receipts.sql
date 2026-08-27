create table public.user_receipts (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  receipt_id text not null
    references public.verification_receipts(receipt_id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, receipt_id)
);

create index user_receipts_owner_history_idx
  on public.user_receipts (user_id, saved_at desc, receipt_id);

alter table public.user_receipts enable row level security;

revoke all on public.user_receipts from anon, authenticated;
grant select, insert, delete on public.user_receipts to authenticated;

create policy "users can read their saved receipts"
  on public.user_receipts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users can save receipt references"
  on public.user_receipts
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users can remove their saved receipts"
  on public.user_receipts
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
