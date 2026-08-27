-- Keep ownership and save time database-assigned, including for direct API calls.
revoke insert on public.user_receipts from authenticated;
grant insert (receipt_id) on public.user_receipts to authenticated;
