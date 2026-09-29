"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { useBalancesHidden } from "@/components/app-shell";
import { BenefitCard } from "@/components/benefits/benefit-card";
import { BenefitForm } from "@/components/benefits/benefit-form";
import { usePersonalBenefits } from "@/components/benefits/personal-benefits-provider";
import { usePersonalFinance } from "@/components/finance/personal-finance-provider";
import type { PersonalBenefit } from "@/lib/benefits/types";

export function BenefitsContent({ periodStart }: { periodStart: string }) {
  const router = useRouter();
  const hidden = useBalancesHidden();
  const finance = usePersonalFinance();
  const { benefits, freshness, error, isLoading, refresh, disableBenefit, duplicateBenefit } = usePersonalBenefits();
  const [editing, setEditing] = useState<PersonalBenefit | "new" | null>(null);
  const [duplicating, setDuplicating] = useState<PersonalBenefit | null>(null);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState<{ message: string; month?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [changingPeriod, startTransition] = useTransition();
  const cards = finance.ledger.accounts.filter((account) => account.accountType === "credit_card");
  const cardsUnavailable = finance.freshness === "offline" && finance.lastUpdatedAt === null;
  const cardsLoading = finance.isSyncing && !cards.length;
  const groups = useMemo(() => {
    const result = new Map<string, { label: string; benefits: PersonalBenefit[] }>();
    for (const benefit of benefits) {
      let group = result.get(benefit.accountId);
      if (!group) { group = { label: benefit.accountLabel, benefits: [] }; result.set(benefit.accountId, group); }
      group.benefits.push(benefit);
    }
    return [...result.entries()];
  }, [benefits]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true); setActionError(""); setNotice(null);
    try { await action(); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : "No pudimos actualizar el beneficio. Volvé a intentar."); }
    finally { setBusy(false); }
  }

  function beginDuplicate(benefit: PersonalBenefit) {
    setEditing(null); setDuplicating(benefit); setValidFrom(""); setValidUntil(""); setActionError(""); setNotice(null);
  }

  function duplicate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!duplicating || duplicating.recurrence !== "monthly" || busy) return;
    if (!validFrom || !validUntil || validUntil < validFrom) { setActionError("Elegí una vigencia válida para el nuevo período."); return; }
    void runAction(async () => {
      await duplicateBenefit(duplicating.id, validFrom, validUntil);
      setDuplicating(null);
      setNotice({ message: "Beneficio duplicado como borrador.", month: validFrom.slice(0, 7) });
    });
  }

  return <div className="grid gap-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Tus tarjetas</p><h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Beneficios</h1><p className="mt-4 max-w-xl text-base leading-7 text-muted">Organizá tus promociones y consultá por separado el disponible para compras y reintegros.</p></div><button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-60" disabled={busy || changingPeriod || editing !== null || duplicating !== null} onClick={() => { setEditing("new"); setDuplicating(null); setActionError(""); setNotice(null); }} type="button">Nuevo beneficio</button></div>
    <div className="flex flex-wrap items-end justify-between gap-4"><label className="grid gap-2 text-sm font-semibold">Período<input className="rounded-xl border border-border bg-background px-4 py-3" disabled={busy || editing !== null || duplicating !== null || changingPeriod} onChange={(event) => { const month = event.target.value; if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) startTransition(() => router.push(`/beneficios?periodo=${month}`)); }} type="month" value={periodStart.slice(0, 7)} /></label>{freshness !== "server" ? <p className="text-sm text-muted" role="status">{freshness === "cached" ? "Mostrando beneficios guardados." : "Sin datos actualizados de beneficios."}</p> : null}</div>
    {isLoading || changingPeriod ? <p role="status">Cargando beneficios…</p> : null}
    {error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 p-4" role="alert"><p>{error}</p><button className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-60" disabled={busy || isLoading} onClick={() => void runAction(refresh)} type="button">Reintentar beneficios</button></div> : null}
    {actionError ? <p className="text-danger" role="alert">{actionError}</p> : null}
    {notice ? <p className="text-signal" role="status">{notice.message}{notice.month && notice.month !== periodStart.slice(0, 7) ? <> <Link className="font-semibold underline" href={`/beneficios?periodo=${notice.month}`}>Ver período guardado</Link></> : null}</p> : null}
    {editing ? <BenefitForm initialValue={editing === "new" ? undefined : editing} key={editing === "new" ? "new" : editing.id} onCancel={() => setEditing(null)} onSaved={(draft) => { setEditing(null); setNotice({ message: "Beneficio guardado.", month: draft.validFrom.slice(0, 7) }); }} periodStart={periodStart} /> : null}
    {!editing ? cardsLoading ? <p role="status">Cargando tarjetas…</p> : cardsUnavailable ? <div className="grid justify-items-start gap-3 rounded-xl border border-danger/30 p-4" role="alert"><p>No pudimos cargar tus tarjetas. Volvé a intentar.</p><button className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-60" disabled={busy} onClick={() => void runAction(finance.refresh)} type="button">Reintentar tarjetas</button></div> : !cards.length ? <section className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-serif text-2xl font-semibold">Todavía no registraste tarjetas de crédito</h2><p className="mt-2 text-muted">Agregá una tarjeta para configurar sus promociones.</p><Link className="mt-4 inline-block font-semibold text-signal underline" href="/cuentas">Registrar tarjeta</Link></section> : null : null}
    {duplicating ? <form aria-label="Duplicar beneficio" className="grid gap-4 rounded-2xl border border-border bg-panel p-5" onSubmit={duplicate}><h2 className="font-serif text-2xl font-semibold">Duplicar {duplicating.merchantName}</h2><p className="text-sm text-muted">Elegí la vigencia del nuevo período. Se copiará como borrador.</p><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Nueva fecha inicial<input className="rounded-xl border border-border bg-background px-4 py-3" disabled={busy} onChange={(event) => setValidFrom(event.target.value)} required type="date" value={validFrom} /></label><label className="grid gap-2 text-sm font-semibold">Nueva fecha final<input className="rounded-xl border border-border bg-background px-4 py-3" disabled={busy} min={validFrom} onChange={(event) => setValidUntil(event.target.value)} required type="date" value={validUntil} /></label></div><div className="flex flex-wrap gap-3"><button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-60" disabled={busy} type="submit">{busy ? "Duplicando…" : "Duplicar beneficio"}</button><button className="rounded-xl border border-border px-4 py-3 font-semibold" disabled={busy} onClick={() => setDuplicating(null)} type="button">Cancelar</button></div></form> : null}
    {groups.map(([accountId, group]) => <section aria-labelledby={`benefits-${accountId}`} className="grid gap-4" key={accountId}><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-serif text-2xl font-semibold" id={`benefits-${accountId}`}>{group.label}</h2><span className="text-sm text-muted">{group.benefits.length} beneficios</span></div><ul className="grid gap-4 xl:grid-cols-2">{group.benefits.map((benefit) => <li className="min-w-0" key={benefit.id}><BenefitCard benefit={benefit} busy={busy || isLoading || changingPeriod || editing !== null || duplicating !== null} hidden={hidden} onDisable={(id) => void runAction(async () => { await disableBenefit(id); setNotice({ message: "Beneficio desactivado." }); })} onDuplicate={beginDuplicate} onEdit={(value) => { setEditing(value); setDuplicating(null); setActionError(""); setNotice(null); }} /></li>)}</ul></section>)}
    {!benefits.length && !error && !isLoading && !changingPeriod && freshness === "server" && cards.length > 0 ? <section className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-serif text-2xl font-semibold">Todavía no tenés beneficios en este período</h2><p className="mt-2 text-muted">Cargá una promoción manual desde Nuevo beneficio.</p></section> : null}
    <p className="text-sm leading-6 text-muted">Los reintegros son estimaciones informativas y no aumentan el saldo de tus cuentas. Las fuentes se guardan como enlaces de consulta.</p>
  </div>;
}
