alter table public.verification_receipts
  validate constraint verification_receipts_version_check;

alter table public.verification_receipts
  validate constraint verification_receipts_identity_check;
