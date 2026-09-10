import type { RecurrenceRule } from "@/lib/reminders/types";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date {
  if (!isoDatePattern.test(value)) throw new Error("La fecha debe tener el formato AAAA-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("La fecha no es válida.");
  }
  return date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function withClampedDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

export function validateRecurrenceRule(rule: RecurrenceRule): void {
  if (rule.type === "weekly" && (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6)) throw new Error("Elegí un día de la semana válido.");
  if (rule.type === "monthly" && (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31)) throw new Error("Elegí un día del mes válido.");
  if (rule.type === "annual" && (!Number.isInteger(rule.month) || rule.month < 1 || rule.month > 12 || !Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31)) throw new Error("Elegí una fecha anual válida.");
  if (rule.type === "custom" && (!Number.isInteger(rule.interval) || rule.interval < 1 || !["days", "weeks", "months"].includes(rule.unit))) throw new Error("Definí un intervalo personalizado válido.");
}

export function calculateNextDueDate(currentDate: string, rule: RecurrenceRule): string {
  const current = parseIsoDate(currentDate);
  validateRecurrenceRule(rule);

  if (rule.type === "weekly") {
    const delta = (rule.weekday - current.getUTCDay() + 7) % 7 || 7;
    current.setUTCDate(current.getUTCDate() + delta);
    return formatIsoDate(current);
  }

  if (rule.type === "monthly") {
    return formatIsoDate(withClampedDay(current.getUTCFullYear(), current.getUTCMonth() + 1, rule.day));
  }

  if (rule.type === "annual") {
    return formatIsoDate(withClampedDay(current.getUTCFullYear() + 1, rule.month - 1, rule.day));
  }

  if (rule.unit === "days" || rule.unit === "weeks") {
    current.setUTCDate(current.getUTCDate() + rule.interval * (rule.unit === "weeks" ? 7 : 1));
    return formatIsoDate(current);
  }

  return formatIsoDate(withClampedDay(current.getUTCFullYear(), current.getUTCMonth() + rule.interval, current.getUTCDate()));
}
