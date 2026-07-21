create table public.verification_receipts (
  receipt_id text primary key,
  signature text not null,
  cluster text not null check (cluster in ('mainnet-beta', 'devnet', 'testnet')),
  slot bigint,
  verdict text not null check (verdict in ('verified', 'rejected', 'indeterminate')),
  reason_code text not null,
  emitter_program_id text,
  event_position integer,
  event_data_hash text,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index verification_receipts_signature_idx
  on public.verification_receipts (signature);

alter table public.verification_receipts enable row level security;

-- Receipt writes are server-only through the InsForge admin client.
revoke insert, update, delete on public.verification_receipts from anon, authenticated;
grant select on public.verification_receipts to anon, authenticated;

create policy "receipts are publicly readable"
  on public.verification_receipts
  for select
  to anon, authenticated
  using (true);

