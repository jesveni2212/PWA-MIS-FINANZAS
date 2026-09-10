"use client";

import { type FormEvent, useState } from "react";

import { MoneyInput } from "@/components/ui/money-input";
import { createReminder, updateReminder } from "@/lib/reminders/repository";
import { validateRecurrenceRule } from "@/lib/reminders/recurrence";
import type { Reminder, ReminderDraft, ReminderUpdate, RecurrenceRule, RecurrenceType } from "@/lib/reminders/types";

type ReminderFormProps = { initialValue?: Reminder; onSaved: () => void | Promise<void>; onCancel?: () => void };

const today = () => new Date().toISOString().slice(0, 10);

export function ReminderForm({ initialValue, onSaved, onCancel }: ReminderFormProps) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [category, setCategory] = useState(initialValue?.category ?? "");
  const [amount, setAmount] = useState(initialValue?.amount === null || initialValue?.amount === undefined ? "" : String(initialValue.amount));
  const [currency, setCurrency] = useState<"PYG" | "USD">(initialValue?.currency ?? "PYG");
  const [type, setType] = useState<RecurrenceType>(initialValue?.recurrenceType ?? "monthly");
  const [weekday, setWeekday] = useState(String(initialValue?.recurrenceRule.type === "weekly" ? initialValue.recurrenceRule.weekday : 1));
  const [day, setDay] = useState(String(initialValue?.recurrenceRule.type === "monthly" || initialValue?.recurrenceRule.type === "annual" ? initialValue.recurrenceRule.day : 1));
  const [month, setMonth] = useState(String(initialValue?.recurrenceRule.type === "annual" ? initialValue.recurrenceRule.month : 1));
  const [interval, setInterval] = useState(String(initialValue?.recurrenceRule.type === "custom" ? initialValue.recurrenceRule.interval : 1));
  const [unit, setUnit] = useState<"days" | "weeks" | "months">(initialValue?.recurrenceRule.type === "custom" ? initialValue.recurrenceRule.unit : "months");
  const [startDate, setStartDate] = useState(initialValue?.startDate ?? today());
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(String(initialValue?.notifyDaysBefore ?? 1));
  const [active, setActive] = useState(initialValue?.active ?? true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function currentRule(): RecurrenceRule {
    if (type === "weekly") return { type, weekday: Number(weekday) };
    if (type === "monthly") return { type, day: Number(day) };
    if (type === "annual") return { type, month: Number(month), day: Number(day) };
    return { type, interval: Number(interval), unit };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rule = currentRule();
    const numericAmount = amount ? Number(amount) : null;
    const lead = Number(notifyDaysBefore);
    if (!name.trim() || !startDate || (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount < 0)) || !Number.isInteger(lead) || lead < 0 || lead > 30) { setMessage("Completá el nombre, fecha, importe y anticipación con datos válidos."); return; }
    try { validateRecurrenceRule(rule); } catch (error) { setMessage(error instanceof Error ? error.message : "Definí una regla válida."); return; }
    setSaving(true); setMessage("");
    const draft: ReminderDraft = { name: name.trim(), category: category.trim() || null, amount: numericAmount, currency: numericAmount === null ? null : currency, recurrenceRule: rule, startDate, notifyDaysBefore: lead, timezone: "America/Asuncion" };
    try {
      if (initialValue) await updateReminder({ ...draft, id: initialValue.id, active } satisfies ReminderUpdate);
      else await createReminder(draft);
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos guardar el recordatorio."); }
    finally { setSaving(false); }
  }

  return <form className="grid gap-5 rounded-2xl border border-border bg-panel p-5 sm:p-6" onSubmit={submit}>
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">{initialValue ? "Editar recordatorio" : "Nuevo recordatorio"}</p><h2 className="mt-2 font-serif text-2xl font-semibold">Un aviso para no olvidarte</h2></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-name">Nombre<input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-name" onChange={(event) => setName(event.target.value)} required value={name} /></label><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-category">Categoría <span className="font-normal text-muted">(opcional)</span><input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-category" onChange={(event) => setCategory(event.target.value)} value={category} /></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-amount">Importe <span className="font-normal text-muted">(opcional)</span><MoneyInput className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-amount" min="0" onChange={setAmount} step="0.01" value={amount} /></label><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-currency">Moneda<select className="rounded-xl border border-border bg-background px-4 py-3" disabled={!amount} id="reminder-currency" onChange={(event) => setCurrency(event.target.value as "PYG" | "USD")} value={currency}><option value="PYG">Guaraníes (PYG)</option><option value="USD">Dólares (USD)</option></select></label></div>
    <label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-recurrence">Repetición<select className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-recurrence" onChange={(event) => setType(event.target.value as RecurrenceType)} value={type}><option value="monthly">Mensual</option><option value="weekly">Semanal</option><option value="annual">Anual</option><option value="custom">Personalizada</option></select></label>
    {type === "weekly" ? <label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-weekday">Día de la semana<select className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-weekday" onChange={(event) => setWeekday(event.target.value)} value={weekday}>{["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((label, value) => <option key={label} value={value}>{label}</option>)}</select></label> : null}
    {type === "monthly" ? <label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-day">Día del mes<input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-day" max="31" min="1" onChange={(event) => setDay(event.target.value)} type="number" value={day} /></label> : null}
    {type === "annual" ? <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-month">Mes<input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-month" max="12" min="1" onChange={(event) => setMonth(event.target.value)} type="number" value={month} /></label><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-annual-day">Día<input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-annual-day" max="31" min="1" onChange={(event) => setDay(event.target.value)} type="number" value={day} /></label></div> : null}
    {type === "custom" ? <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-interval">Cada<input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-interval" min="1" onChange={(event) => setInterval(event.target.value)} type="number" value={interval} /></label><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-unit">Unidad<select className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-unit" onChange={(event) => setUnit(event.target.value as typeof unit)} value={unit}><option value="days">Días</option><option value="weeks">Semanas</option><option value="months">Meses</option></select></label></div> : null}
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-start-date">Fecha inicial<input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-start-date" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label><label className="grid gap-2 text-sm font-semibold" htmlFor="reminder-lead">Avisar con anticipación <span className="font-normal text-muted">(días)</span><input className="rounded-xl border border-border bg-background px-4 py-3" id="reminder-lead" max="30" min="0" onChange={(event) => setNotifyDaysBefore(event.target.value)} type="number" value={notifyDaysBefore} /></label></div>
    {initialValue ? <label className="flex items-center gap-3 text-sm font-semibold"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" /> Recordatorio activo</label> : null}
    {message ? <p aria-live="polite" role="alert" className="text-danger">{message}</p> : null}
    <div className="flex flex-wrap gap-3"><button className="w-fit rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:opacity-60" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar recordatorio"}</button>{onCancel ? <button className="rounded-xl border border-border px-5 py-3 font-semibold" disabled={saving} onClick={onCancel} type="button">Cancelar</button> : null}</div>
  </form>;
}
