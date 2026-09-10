"use client";

import { useEffect, useRef, useState } from "react";

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const isPending = occurrence?.status === "pending";

  useEffect(() => {
    if (!deleteOpen) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    cancelDeleteRef.current?.focus();
    document.body.style.overflow = "hidden";

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) setDeleteOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement?.isConnected) previousActiveElement.focus();
    };
  }, [deleteOpen, busy]);

  async function action(action: () => void | Promise<void>) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  async function handleDelete() {
    try {
      await action(() => onDelete(reminder.id));
      setDeleteOpen(false);
    } catch {
      // The parent displays the operation error and keeps the dialog available for retry.
    }
  }

  return <>
    <article className="grid gap-4 rounded-2xl border border-border bg-panel p-5">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">{reminder.category ?? "Recordatorio"}</p><h3 className="mt-2 text-lg font-semibold">{reminder.name}</h3></div>
      <div className="flex flex-wrap justify-end gap-2"><button aria-label={`Editar ${reminder.name}`} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold" onClick={() => onEdit(reminder)} type="button">Editar</button><button aria-haspopup="dialog" aria-label={`Eliminar ${reminder.name}`} className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-semibold text-danger disabled:opacity-60" disabled={busy} onClick={() => setDeleteOpen(true)} type="button">Eliminar</button></div>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3 text-sm"><div><p className="text-muted">Próximo vencimiento</p><p className="mt-1 font-semibold">{occurrence?.dueOn ?? reminder.nextDueOn}</p></div>{reminder.amount !== null && reminder.currency ? <MoneyValue amount={reminder.amount} className="font-semibold" currency={reminder.currency} /> : <span className="text-muted">Importe variable</span>}</div>
    {!reminder.active ? <span className="w-fit rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">Inactivo</span> : null}
    {occurrence?.status === "paid" ? <span className="w-fit text-sm font-semibold text-signal">Pagado</span> : null}
    {occurrence?.status === "omitted" ? <span className="w-fit text-sm font-semibold text-muted">Omitido</span> : null}
    {isPending && occurrence ? <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`postpone-${occurrence.id}`}>Nueva fecha<input className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-text" id={`postpone-${occurrence.id}`} onChange={(event) => setNextDueOn(event.target.value)} type="date" value={nextDueOn} /></label><button className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy || !nextDueOn} onClick={() => void action(() => onPostpone(occurrence.id, nextDueOn))} type="button">Posponer</button><div className="flex gap-2"><button className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60" disabled={busy} onClick={() => void action(() => onResolve(occurrence.id, "paid"))} type="button">Marcar como pagado</button><button className="rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => void action(() => onResolve(occurrence.id, "omitted"))} type="button">Omitir</button></div></div> : null}
    </article>
    {deleteOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget && !busy) setDeleteOpen(false); }}>
      <div aria-describedby={`delete-description-${reminder.id}`} aria-labelledby={`delete-title-${reminder.id}`} aria-modal="true" className="w-full max-w-md rounded-3xl border border-danger/30 bg-panel-raised p-6 shadow-2xl shadow-black/40" ref={dialogRef} role="dialog">
        <div className="flex items-start gap-4"><div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-danger/15 text-2xl font-bold text-danger">!</div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">Acción definitiva</p><h2 className="mt-2 font-serif text-2xl font-semibold" id={`delete-title-${reminder.id}`}>¿Eliminar “{reminder.name}”?</h2></div></div>
        <p className="mt-5 text-sm leading-6 text-muted" id={`delete-description-${reminder.id}`}>Se borrarán este recordatorio, todas sus ocurrencias y su historial. Esta acción no se puede deshacer.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => setDeleteOpen(false)} ref={cancelDeleteRef} type="button">Cancelar</button><button className="rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-60" disabled={busy} onClick={() => void handleDelete()} type="button">{busy ? "Eliminando…" : "Eliminar definitivamente"}</button></div>
      </div>
    </div> : null}
  </>;
}
