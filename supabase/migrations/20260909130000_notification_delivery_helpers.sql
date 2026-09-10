create or replace function public.claim_notification_delivery(p_occurrence_id uuid, p_subscription_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notification_deliveries(occurrence_id, subscription_id)
    values (p_occurrence_id, p_subscription_id)
    on conflict (occurrence_id, subscription_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_notification_delivery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery(uuid, uuid) to service_role;
