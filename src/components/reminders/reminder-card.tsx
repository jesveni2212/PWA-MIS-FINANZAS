"use client";

import { useState } from "react";

import { MoneyValue } from "@/components/ui/money-value";
import type { Reminder, ReminderOccurrence, ReminderOccurrenceStatus } from "@/lib/reminders/types";

type ReminderCardProps = {
  reminder: Reminder;
  occurrence: ReminderOccurrence | null;
  onResolve: (occurrenceId: string, status: Extract<ReminderOccurrenceStatus, "paid" | "omitted">) => void | Promise<void>;
  onPostpone: (occurrenceId: string, nextDueOn: string) => void | Promise<void>;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminderId: string) => void | Promise<void>;
};

export function ReminderCard({ reminder, occurrence, onResolve, onPostpone, onEdit, onDelete }: ReminderCardProps) {
  const [nextDueOn, setNextDueOn] = useState(occurrence?.dueOn ?? reminder.nextDueOn);
  const [busy, setBusy] = useState(false);
  const isPending = occurrence?.status === "pending";

  async function action(action: () => void | Promise<void>) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar definitivamente "${reminder.name}"? Se borrarán sus ocurrencias y su historial.`)) return;
    await action(() => onDelete(reminder.id));
  }

  return <article className="grid gap-4 rounded-2xl border border-border bg-panel p-5">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">{reminder.category ?? "Recordatorio"}</p><h3 className="mt-2 text-lg font-semibold">{reminder.name}</h3></div>
      <div className="flex flex-wrap justify-end gap-2"><button aria-label={`Editar ${reminder.name}`} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold" onClick={() => onEdit(reminder)} type="button">Editar</button><button aria-label={`Eliminar ${reminder.name}`} className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-semibold text-danger disabled:opacity-60" disabled={busy} onClick={() => void handleDelete()} type="button">Eliminar</button></div>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3 text-sm"><div><p className="text-muted">Próximo vencimiento</p><p className="mt-1 font-semibold">{occurrence?.dueOn ?? reminder.nextDueOn}</p></div>{reminder.amount !== null && reminder.currency ? <MoneyValue amount={reminder.amount} className="font-semibold" currency={reminder.currency} /> : <span className="text-muted">Importe variable</span>}</div>
    {!reminder.active ? <span className="w-fit rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">Inactivo</span> : null}
    {occurrence?.status === "paid" ? <span className="w-fit text-sm font-semibold text-signal">Pagado</span> : null}
    {occurrence?.status === "omitted" ? <span className="w-fit text-sm font-semibold text-muted">Omitido</span> : null}
    {isPending && occurrence ? <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`postpone-${occurrence.id}`}>Nueva fecha<input className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-text" id={`postpone-${occurrence.id}`} onChange={(event) => setNextDueOn(event.target.value)} type="date" value={nextDueOn} /></label><button className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy || !nextDueOn} onClick={() => void action(() => onPostpone(occurrence.id, nextDueOn))} type="button">Posponer</button><div className="flex gap-2"><button className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60" disabled={busy} onClick={() => void action(() => onResolve(occurrence.id, "paid"))} type="button">Marcar como pagado</button><button className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => void action(() => onResolve(occurrence.id, "omitted"))} type="button">Omitir</button></div></div> : null}
  </article>;
}
