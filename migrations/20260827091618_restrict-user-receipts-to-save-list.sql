-- PR 5.2 exposes save and list only; deletion is added with account controls.
revoke delete on public.user_receipts from authenticated;

drop policy if exists "users can remove their saved receipts"
  on public.user_receipts;
