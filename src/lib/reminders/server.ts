import { createClient } from "@/lib/supabase/server";
import { normalizeReminderRow } from "@/lib/reminders/repository";
import type { ReminderWithOccurrence } from "@/lib/reminders/types";

export async function loadRemindersServer(): Promise<ReminderWithOccurrence[]> {
  const client = await createClient();
  const { data, error } = await client.from("financial_reminders").select("id,name,category,amount,currency,recurrence_type,recurrence_config,start_date,next_due_on,notify_days_before,timezone,active,created_at,updated_at,financial_reminder_occurrences(id,due_on,status,resolved_at)").order("next_due_on", { ascending: true });
  if (error) throw new Error("No pudimos cargar tus recordatorios.");
  return (data as unknown[]).map(normalizeReminderRow);
}
