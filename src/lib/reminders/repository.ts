import { createClient } from "@/lib/supabase/client";
import { validateRecurrenceRule } from "@/lib/reminders/recurrence";
import type { ReminderDraft, ReminderOccurrence, ReminderOccurrenceStatus, ReminderUpdate, ReminderWithOccurrence, RecurrenceRule, RecurrenceType } from "@/lib/reminders/types";

const reminderLoadError = "No pudimos cargar tus recordatorios.";

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(reminderLoadError);
  return value as Record<string, unknown>;
}

function textValue(row: Record<string, unknown>, key: string, nullable = false): string | null {
  const value = row[key];
  if (value === null && nullable) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(reminderLoadError);
  return value;
}

function numberValue(row: Record<string, unknown>, key: string, nullable = false): number | null {
  const value = row[key];
  if (value === null && nullable) return null;
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new Error(reminderLoadError);
  return number;
}

function normalizeRule(type: RecurrenceType, value: unknown): RecurrenceRule {
  const config = objectValue(value);
  if (type === "weekly") return { type, weekday: numberValue(config, "weekday") as number };
  if (type === "monthly") return { type, day: numberValue(config, "day") as number };
  if (type === "annual") return { type, month: numberValue(config, "month") as number, day: numberValue(config, "day") as number };
  return { type, interval: numberValue(config, "interval") as number, unit: textValue(config, "unit") as "days" | "weeks" | "months" };
}

function normalizeOccurrence(value: unknown, reminderId: string): ReminderOccurrence | null {
  if (value === null || value === undefined) return null;
  const row = objectValue(value);
  const status = textValue(row, "status") as string;
  if (!(["pending", "paid", "omitted"] as string[]).includes(status)) throw new Error(reminderLoadError);
  return {
    id: textValue(row, "id") as string,
    reminderId,
    dueOn: textValue(row, "due_on") as string,
    status: status as ReminderOccurrenceStatus,
    resolvedAt: textValue(row, "resolved_at", true),
  };
}

export function normalizeReminderRow(value: unknown): ReminderWithOccurrence {
  const row = objectValue(value);
  const recurrenceType = textValue(row, "recurrence_type") as RecurrenceType;
  if (!["weekly", "monthly", "annual", "custom"].includes(recurrenceType)) throw new Error(reminderLoadError);
  const id = textValue(row, "id") as string;
  const recurrenceRule = normalizeRule(recurrenceType, row.recurrence_config);
  validateRecurrenceRule(recurrenceRule);
  const nested = Array.isArray(row.financial_reminder_occurrences) ? row.financial_reminder_occurrences : row.occurrence ? [row.occurrence] : [];
  const occurrences = nested.map((item) => normalizeOccurrence(item, id)).filter((item): item is ReminderOccurrence => item !== null).sort((left, right) => left.dueOn.localeCompare(right.dueOn));
  const occurrence = occurrences.find((item) => item.status === "pending") ?? occurrences[0] ?? null;
  return {
    reminder: {
      id,
      name: textValue(row, "name") as string,
      category: textValue(row, "category", true),
      amount: numberValue(row, "amount", true),
      currency: textValue(row, "currency", true) as "PYG" | "USD" | null,
      recurrenceType,
      recurrenceRule,
      startDate: textValue(row, "start_date") as string,
      nextDueOn: textValue(row, "next_due_on") as string,
      notifyDaysBefore: numberValue(row, "notify_days_before") as number,
      timezone: textValue(row, "timezone") as string,
      active: row.active === true,
      createdAt: textValue(row, "created_at") as string,
      updatedAt: textValue(row, "updated_at") as string,
    },
    occurrence,
  };
}

function configForRule(rule: RecurrenceRule): Record<string, number | string> {
  validateRecurrenceRule(rule);
  if (rule.type === "weekly") return { weekday: rule.weekday };
  if (rule.type === "monthly") return { day: rule.day };
  if (rule.type === "annual") return { month: rule.month, day: rule.day };
  return { interval: rule.interval, unit: rule.unit };
}

function nullableText(value: string | null): string | null { return value?.trim() || null; }

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw new Error(error.message || "No pudimos actualizar tus recordatorios.");
  return data as T;
}

export async function loadReminders(): Promise<ReminderWithOccurrence[]> {
  const { data, error } = await createClient().from("financial_reminders").select("id,name,category,amount,currency,recurrence_type,recurrence_config,start_date,next_due_on,notify_days_before,timezone,active,created_at,updated_at,financial_reminder_occurrences(id,due_on,status,resolved_at)").order("next_due_on", { ascending: true });
  if (error) throw new Error(reminderLoadError);
  return (data as unknown[]).map(normalizeReminderRow);
}

export async function createReminder(input: ReminderDraft): Promise<string> {
  return callRpc<string>("create_personal_reminder", {
    p_name: input.name.trim(), p_category: nullableText(input.category), p_amount: input.amount, p_currency: input.currency,
    p_recurrence_type: input.recurrenceRule.type, p_recurrence_config: configForRule(input.recurrenceRule), p_start_date: input.startDate,
    p_notify_days_before: input.notifyDaysBefore, p_timezone: input.timezone,
  });
}

export async function updateReminder(input: ReminderUpdate): Promise<void> {
  await callRpc<void>("update_personal_reminder", {
    p_reminder_id: input.id, p_name: input.name.trim(), p_category: nullableText(input.category), p_amount: input.amount, p_currency: input.currency,
    p_recurrence_type: input.recurrenceRule.type, p_recurrence_config: configForRule(input.recurrenceRule), p_start_date: input.startDate,
    p_notify_days_before: input.notifyDaysBefore, p_timezone: input.timezone, p_active: input.active,
  });
}

export function resolveReminderOccurrence(occurrenceId: string, status: ReminderOccurrenceStatus): Promise<void> {
  return callRpc<void>("resolve_personal_reminder_occurrence", { p_occurrence_id: occurrenceId, p_status: status });
}

export function postponeReminderOccurrence(occurrenceId: string, nextDueOn: string): Promise<void> {
  return callRpc<void>("postpone_personal_reminder_occurrence", { p_occurrence_id: occurrenceId, p_next_due_on: nextDueOn });
}
