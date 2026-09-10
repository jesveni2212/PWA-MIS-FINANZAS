"use client";

import { useCallback, useMemo, useState } from "react";

import { ReminderCard } from "@/components/reminders/reminder-card";
import { ReminderForm } from "@/components/reminders/reminder-form";
import { deleteReminder, loadReminders, postponeReminderOccurrence, resolveReminderOccurrence } from "@/lib/reminders/repository";
import type { Reminder, ReminderOccurrenceStatus, ReminderWithOccurrence } from "@/lib/reminders/types";

type RemindersContentProps = { initialReminders: ReminderWithOccurrence[] };

export function RemindersContent({ initialReminders }: RemindersContentProps) {
  const [reminders, setReminders] = useState(initialReminders);
  const [editing, setEditing] = useState<Reminder | null | "new">(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const refresh = useCallback(async () => {
    setRefreshing(true); setError("");
    try { setReminders(await loadReminders()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "No pudimos actualizar tus recordatorios."); }
    finally { setRefreshing(false); }
  }, []);

  const groups = useMemo(() => {
    const result: Record<"upcoming" | "overdue" | "paid" | "omitted", ReminderWithOccurrence[]> = { upcoming: [], overdue: [], paid: [], omitted: [] };
    reminders.forEach((item) => {
      if (!item.occurrence || item.occurrence.status === "pending" && item.occurrence.dueOn >= today) result.upcoming.push(item);
      else if (item.occurrence.status === "pending") result.overdue.push(item);
      else if (item.occurrence.status === "paid") result.paid.push(item);
      else result.omitted.push(item);
    });
    return result;
  }, [reminders, today]);

  async function resolve(occurrenceId: string, status: Extract<ReminderOccurrenceStatus, "paid" | "omitted">) {
    setError("");
    try { await resolveReminderOccurrence(occurrenceId, status); await refresh(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "No pudimos actualizar el recordatorio."); }
  }

  async function postpone(occurrenceId: string, nextDueOn: string) {
    setError("");
    try { await postponeReminderOccurrence(occurrenceId, nextDueOn); await refresh(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "No pudimos posponer el recordatorio."); }
  }

  async function remove(reminderId: string) {
    setError("");
    try { await deleteReminder(reminderId); setReminders((current) => current.filter((item) => item.reminder.id !== reminderId)); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "No pudimos eliminar el recordatorio."); }
  }

  function group(title: string, items: ReminderWithOccurrence[]) {
    if (!items.length) return null;
    return <section className="grid gap-3" aria-labelledby={`reminders-${title}`}><h2 className="font-serif text-2xl font-semibold" id={`reminders-${title}`}>{title}</h2>{items.map((item) => <ReminderCard key={item.reminder.id} onDelete={remove} onEdit={setEditing} onPostpone={postpone} onResolve={resolve} occurrence={item.occurrence} reminder={item.reminder} />)}</section>;
  }

  return <div className="grid gap-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Avisos inteligentes</p><h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Recordatorios</h1><p className="mt-4 max-w-xl text-base leading-7 text-muted">Agendá pagos e ingresos esperados sin crear movimientos automáticamente.</p></div><button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground" onClick={() => setEditing("new")} type="button">Nuevo recordatorio</button></div>
    {error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4" role="alert"><p>{error}</p><button className="rounded-lg border border-border px-3 py-2 text-sm font-semibold" disabled={refreshing} onClick={() => void refresh()} type="button">Reintentar</button></div> : null}
    {editing ? <ReminderForm initialValue={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} /> : null}
    {group("Próximos", groups.upcoming)}
    {group("Vencidos", groups.overdue)}
    {group("Pagados", groups.paid)}
    {group("Omitidos", groups.omitted)}
    {!reminders.length ? <section className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-serif text-2xl font-semibold">Todavía no tenés recordatorios</h2><p className="mt-2 text-muted">Agendá luz, agua, alquiler o cualquier ingreso esperado.</p></section> : null}
  </div>;
}
