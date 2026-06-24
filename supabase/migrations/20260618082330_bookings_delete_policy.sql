-- BOOKINGS DELETE POLICY
-- Historical repair entry from the remote migration ledger. Users may delete
-- their own booking history rows, but create/edit/cancel still go through RPCs.

drop policy if exists "Users can delete their own bookings" on public.bookings;
create policy "Users can delete their own bookings"
  on public.bookings for delete to authenticated
  using ((select auth.uid()) = user_id);
