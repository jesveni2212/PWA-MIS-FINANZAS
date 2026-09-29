"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { usePersonalBenefits } from "@/components/benefits/personal-benefits-provider";
import { usePersonalFinance } from "@/components/finance/personal-finance-provider";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyValue } from "@/components/ui/money-value";
import { calculateRebateCap } from "@/lib/benefits/matching";
import type { BenefitChannel, BenefitRecurrence, BenefitStatus, PersonalBenefit, PersonalBenefitDraft } from "@/lib/benefits/types";

type BenefitFormProps = { initialValue?: PersonalBenefit; periodStart: string; onSaved?: (draft: PersonalBenefitDraft) => void; onCancel?: () => void };

const inputClass = "min-w-0 w-full rounded-xl border border-border bg-background px-4 py-3 disabled:opacity-60";
const labelClass = "grid min-w-0 gap-2 text-sm font-semibold";
const weekdaysLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function endOfMonth(periodStart: string) {
  const date = new Date(`${periodStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

export function BenefitForm({ initialValue, periodStart, onSaved, onCancel }: BenefitFormProps) {
  const finance = usePersonalFinance();
  const { createBenefit, updateBenefit } = usePersonalBenefits();
  const cards = finance.ledger.accounts.filter((account) => account.accountType === "credit_card");
  const [accountId, setAccountId] = useState(initialValue?.accountId ?? "");
  const [merchant, setMerchant] = useState(initialValue?.merchantName ?? "");
  const [aliases, setAliases] = useState(initialValue?.merchantAliases.join(", ") ?? "");
  const [weekdays, setWeekdays] = useState(initialValue?.weekdays ?? []);
  const [recurrence, setRecurrence] = useState<BenefitRecurrence>(initialValue?.recurrence ?? "monthly");
  const [validFrom, setValidFrom] = useState(initialValue?.validFrom ?? periodStart);
  const [validUntil, setValidUntil] = useState(initialValue?.validUntil ?? endOfMonth(periodStart));
  const [ratePercent, setRatePercent] = useState(initialValue ? String(initialValue.rateBps / 100) : "");
  const [purchaseCap, setPurchaseCap] = useState(initialValue ? String(initialValue.purchaseCap) : "");
  const [currency, setCurrency] = useState(initialValue?.currency ?? "PYG");
  const [channel, setChannel] = useState<BenefitChannel>(initialValue?.channel ?? "all");
  const [conditions, setConditions] = useState(initialValue?.conditions ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialValue?.sourceUrl ?? "");
  const [status, setStatus] = useState<BenefitStatus>(initialValue?.status ?? "draft");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const card = cards.find((account) => account.id === accountId);
  const cardsLoading = finance.isSyncing && !cards.length;
  const cardsUnavailable = finance.freshness === "offline" && finance.lastUpdatedAt === null;
  const weekly = recurrence === "weekly" || initialValue?.recurrence === "weekly";
  const rateBps = Math.round(Number(ratePercent) * 100);
  const numericCap = Number(purchaseCap);
  const validNumbers = Number.isSafeInteger(rateBps) && rateBps > 0 && rateBps <= 10000 && Number.isFinite(numericCap) && numericCap > 0 && numericCap <= 999_999_999_999.99;
  const rebateCap = validNumbers ? calculateRebateCap(numericCap, rateBps) : 0;

  async function retryCards() {
    setRetrying(true); setMessage("");
    try { await finance.refresh(); }
    catch { setMessage("No pudimos cargar tus tarjetas. Volvé a intentar."); }
    finally { setRetrying(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !card || cardsUnavailable || weekly) return;
    let validSource = !sourceUrl.trim();
    try { validSource ||= ["https:", "http:"].includes(new URL(sourceUrl.trim()).protocol); } catch { /* Report invalid URL below. */ }
    if (!merchant.trim() || !validNumbers || !weekdays.length || !validFrom || !validUntil || validUntil < validFrom || !validSource) {
      setMessage("Revisá el comercio, los días, la vigencia, el porcentaje, el tope y la URL de la fuente.");
      return;
    }
    if (currency !== card.currency) {
      setMessage("La moneda del beneficio debe coincidir con la de la tarjeta elegida.");
      return;
    }
    const draft: PersonalBenefitDraft = {
      accountId: card.id, accountLabel: `${card.institution} · ${card.name}`,
      merchantName: merchant.trim(), merchantAliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
      benefitType: "rebate", rateBps, purchaseCap: numericCap, rebateCap, currency, recurrence,
      weekdays: [...weekdays].sort((a, b) => a - b), validFrom, validUntil, channel,
      conditions: conditions.trim() || null, sourceUrl: sourceUrl.trim() || null,
      sourceCheckedAt: initialValue?.sourceCheckedAt ?? null, status,
    };
    setSaving(true); setMessage("");
    try {
      if (initialValue) await updateBenefit(initialValue.id, draft);
      else await createBenefit(draft);
      setMessage("Beneficio guardado.");
      onSaved?.(draft);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos guardar el beneficio. Volvé a intentar."); }
    finally { setSaving(false); }
  }

  return <form aria-label={initialValue ? "Editar beneficio" : "Nuevo beneficio"} className="grid gap-5 rounded-2xl border border-border bg-panel p-5 sm:p-6" onSubmit={submit}>
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">{initialValue ? "Editar beneficio" : "Nuevo beneficio"}</p><h2 className="mt-2 font-serif text-2xl font-semibold">Promoción manual</h2><p className="mt-2 text-sm text-muted">Configurá la vigencia y los topes según las condiciones de la promoción.</p></div>
    {cardsLoading ? <p role="status">Cargando tarjetas…</p> : cardsUnavailable ? <div className="grid justify-items-start gap-3" role="alert"><p>No pudimos cargar tus tarjetas. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-60" disabled={retrying} onClick={() => void retryCards()} type="button">Reintentar tarjetas</button></div> : !cards.length ? <p className="text-muted">Todavía no registraste tarjetas de crédito. <Link className="font-semibold text-signal underline" href="/cuentas">Registrar tarjeta</Link></p> : null}
    <fieldset className="grid min-w-0 gap-5 disabled:opacity-70" disabled={saving || weekly}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Tarjeta de crédito<select className={inputClass} disabled={cardsUnavailable || cardsLoading} onChange={(event) => { setAccountId(event.target.value); const selected = cards.find((account) => account.id === event.target.value); if (selected) setCurrency(selected.currency); }} required value={accountId}><option value="">Seleccioná una tarjeta</option>{cards.map((account) => <option key={account.id} value={account.id}>{account.institution} · {account.name}</option>)}</select></label>
        <label className={labelClass}>Comercio<input className={inputClass} onChange={(event) => setMerchant(event.target.value)} required value={merchant} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Alias del comercio (separados por comas)<input className={inputClass} onChange={(event) => setAliases(event.target.value)} value={aliases} /></label>
      </div>
      <fieldset className="grid gap-3"><legend className="mb-3 text-sm font-semibold">Días de la promoción</legend><div className="flex flex-wrap gap-2">{weekdaysLabels.map((label, day) => <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm has-[:checked]:border-signal has-[:checked]:bg-brand-soft" key={day}><input checked={weekdays.includes(day)} onChange={(event) => setWeekdays((current) => event.target.checked ? [...current, day] : current.filter((value) => value !== day))} type="checkbox" />{label}</label>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Recurrencia<select aria-describedby="benefit-recurrence-help" className={inputClass} onChange={(event) => setRecurrence(event.target.value as BenefitRecurrence)} value={recurrence}><option value="monthly">Mensual</option><option disabled value="weekly">Semanal (no disponible para guardar)</option></select></label>
        <label className={labelClass}>Estado<select className={inputClass} onChange={(event) => setStatus(event.target.value as BenefitStatus)} value={status}><option value="draft">Borrador</option><option value="active">Activo</option><option value="expired">Vencido</option><option value="disabled">Desactivado</option></select></label>
        <label className={labelClass}>Desde<input className={inputClass} onChange={(event) => setValidFrom(event.target.value)} required type="date" value={validFrom} /></label>
        <label className={labelClass}>Hasta<input className={inputClass} min={validFrom} onChange={(event) => setValidUntil(event.target.value)} required type="date" value={validUntil} /></label>
        <label className={labelClass}>Porcentaje de reintegro<input className={inputClass} max="100" min="0.01" onChange={(event) => setRatePercent(event.target.value)} required step="0.01" type="number" value={ratePercent} /></label>
        <label className={labelClass}>Tope de compras<MoneyInput className={inputClass} onChange={setPurchaseCap} required value={purchaseCap} /></label>
        <label className={labelClass}>Moneda<select className={inputClass} onChange={(event) => setCurrency(event.target.value)} value={currency}><option value="PYG">Guaraníes (PYG)</option><option value="USD">Dólares (USD)</option></select></label>
        <label className={labelClass}>Canal<select className={inputClass} onChange={(event) => setChannel(event.target.value as BenefitChannel)} value={channel}><option value="all">Todos</option><option value="physical">Presencial</option><option value="app">Aplicación</option><option value="web">Web</option></select></label>
      </div>
      <div className="rounded-xl border border-signal/30 bg-brand-soft p-4"><p className="text-sm text-muted">Tope de reintegro = tope de compras × porcentaje</p><output aria-label="Tope de reintegro calculado" className="mt-2 block text-2xl font-semibold text-signal"><MoneyValue amount={rebateCap} currency={currency} /></output></div>
      <label className={labelClass}>Condiciones<textarea className={inputClass} onChange={(event) => setConditions(event.target.value)} rows={3} value={conditions} /></label>
      <label className={labelClass}>URL de la fuente (opcional)<input className={inputClass} onChange={(event) => setSourceUrl(event.target.value)} type="url" value={sourceUrl} /></label>
    </fieldset>
    <p className="text-sm text-muted" id="benefit-recurrence-help">{weekly ? "Los beneficios semanales se pueden consultar, pero todavía no editar ni duplicar." : "En esta versión podés guardar promociones mensuales. Los días elegidos determinan cuándo aplican."}</p>
    {message ? <p className={message === "Beneficio guardado." ? "text-signal" : "text-danger"} role={message === "Beneficio guardado." ? "status" : "alert"}>{message}</p> : null}
    <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || !card || cardsUnavailable || weekly} type="submit">{saving ? "Guardando…" : "Guardar beneficio"}</button>{onCancel ? <button className="rounded-xl border border-border px-5 py-3 font-semibold" disabled={saving} onClick={onCancel} type="button">Cancelar</button> : null}</div>
  </form>;
}
