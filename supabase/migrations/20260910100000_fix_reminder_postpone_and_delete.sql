create or replace function public.postpone_personal_reminder_occurrence(p_occurrence_id uuid, p_next_due_on date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_reminder_id uuid;
  v_target_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if p_next_due_on is null then
    raise exception using errcode = '22023', message = 'A due date is required';
  end if;

  -- Lock the owned reminder while checking the target date so two postponements
  -- cannot make the same reminder inconsistent at the same time.
  select o.reminder_id
    into v_reminder_id
    from public.financial_reminder_occurrences o
    join public.financial_reminders r on r.id = o.reminder_id
   where o.id = p_occurrence_id
     and o.status = 'pending'
     and r.created_by = v_user_id
   for update of o, r;

  if v_reminder_id is null then
    raise exception using errcode = '42501', message = 'Occurrence ownership is required';
  end if;

  select o.status
    into v_target_status
    from public.financial_reminder_occurrences o
   where o.reminder_id = v_reminder_id
     and o.due_on = p_next_due_on
     and o.id <> p_occurrence_id
   for update;

  if found then
    if v_target_status <> 'pending' then
      raise exception using errcode = '23505', message = 'Ya existe otra ocurrencia en la fecha seleccionada';
    end if;

    -- Keep the existing pending occurrence as the single source of truth and
    -- preserve the postponed occurrence in the history.
    update public.financial_reminder_occurrences
       set status = 'omitted', resolved_at = timezone('utc', now())
     where id = p_occurrence_id;
  else
    update public.financial_reminder_occurrences
       set due_on = p_next_due_on
     where id = p_occurrence_id;
  end if;

  update public.financial_reminders
     set next_due_on = p_next_due_on, updated_at = timezone('utc', now())
   where id = v_reminder_id
     and created_by = v_user_id;
end;
$$;

create or replace function public.delete_personal_reminder(p_reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  delete from public.financial_reminders
   where id = p_reminder_id
     and created_by = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'Reminder ownership is required';
  end if;
end;
$$;

revoke all on function public.postpone_personal_reminder_occurrence(uuid, date) from public;
revoke all on function public.delete_personal_reminder(uuid) from public;
grant execute on function public.postpone_personal_reminder_occurrence(uuid, date) to authenticated;
grant execute on function public.delete_personal_reminder(uuid) to authenticated;
