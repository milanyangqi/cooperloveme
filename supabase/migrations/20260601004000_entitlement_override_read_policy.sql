create policy entitlement_overrides_select_own
on public.entitlement_overrides
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.entitlement_overrides to authenticated;
