grant delete on public.user_receipts to authenticated;

drop policy if exists "users can remove their saved receipts"
  on public.user_receipts;

create policy "users can remove their saved receipts"
  on public.user_receipts
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
