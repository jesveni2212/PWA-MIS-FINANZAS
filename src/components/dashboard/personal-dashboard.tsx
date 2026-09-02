"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBalancesHidden } from "@/components/app-shell";
import { MoneyValue } from "@/components/ui/money-value";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalAccount, PersonalLedger, PersonalTransaction } from "@/lib/finance/types";

type CurrencySummary = {
  currency: string;
  availableTotal: number;
  creditDebtTotal: number;
  netWorth: number;
};

function accountName(accountId: string | null, accounts: PersonalAccount[]) {
  const account = accounts.find((item) => item.id === accountId);
  return account ? `${account.institution} · ${account.name}` : "una cuenta";
}

function transactionTitle(transaction: PersonalTransaction, accounts: PersonalAccount[]) {
  const source = accountName(transaction.sourceAccountId, accounts);
  const destination = accountName(transaction.destinationAccountId, accounts);
  if (transaction.operationType === "income") return `Ingreso a ${destination}`;
  if (transaction.operationType === "expense") return `Gasto desde ${source}`;
  if (transaction.operationType === "card_purchase") return `Compra con ${source}`;
  if (transaction.operationType === "transfer") return `${source} → ${destination}`;
  return `Pago de ${destination} desde ${source}`;
}

function createCurrencySummaries(accounts: PersonalAccount[]): CurrencySummary[] {
  const totals = new Map<string, Omit<CurrencySummary, "currency" >>();
  for (const account of accounts) {
    const current = totals.get(account.currency) ?? { availableTotal: 0, creditDebtTotal: 0, netWorth: 0 };
    if (account.accountType === "credit_card") current.creditDebtTotal += account.currentBalance;
    else current.availableTotal += account.currentBalance;
    totals.set(account.currency, current);
  }

  return [...totals.entries()]
    .map(([currency, totalsForCurrency]) => ({ ...totalsForCurrency, currency, netWorth: totalsForCurrency.availableTotal - totalsForCurrency.creditDebtTotal }))
    .sort((a, b) => a.currency === "PYG" ? -1 : b.currency === "PYG" ? 1 : a.currency.localeCompare(b.currency));
}

export function PersonalDashboard() {
  const balancesHidden = useBalancesHidden();
  const [ledger, setLedger] = useState<PersonalLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setLedger(await loadPersonalLedger());
    } catch {
      setLedger(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const summaries = useMemo(() => createCurrencySummaries(ledger?.accounts ?? []), [ledger]);
  const creditCards = ledger?.accounts.filter((account) => account.accountType === "credit_card") ?? [];

  if (loading) return <p aria-live="polite">Cargando resumen personal…</p>;
  if (error) return <div className="grid justify-items-start gap-3" role="status"><p>No pudimos cargar tus finanzas personales. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void load()} type="button">Reintentar</button></div>;

  const hasAccounts = (ledger?.accounts.length ?? 0) > 0;
  return <div className="grid gap-8">
    <section aria-labelledby="net-worth-heading" className="overflow-hidden rounded-[2rem] border border-border bg-panel p-6 shadow-2xl shadow-black/15 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Resumen personal</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl" id="net-worth-heading">Patrimonio neto</h1>
      <p className="mt-2 text-sm text-muted">Sin convertir ni mezclar monedas.</p>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {summaries.map((summary) => <article aria-label={`Resumen en ${summary.currency}`} className="rounded-2xl border border-border bg-background/45 p-5" key={summary.currency}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">{summary.currency}</p>
          <p className="mt-2 text-sm text-muted">Patrimonio neto</p>
          <MoneyValue amount={summary.netWorth} className="mt-1 block text-3xl font-semibold tracking-tight text-signal" currency={summary.currency} hidden={balancesHidden} />
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm"><div><dt className="text-muted">Disponible</dt><dd><MoneyValue amount={summary.availableTotal} className="mt-1 block font-semibold" currency={summary.currency} hidden={balancesHidden} /></dd></div><div><dt className="text-muted">Deuda</dt><dd><MoneyValue amount={summary.creditDebtTotal} className="mt-1 block font-semibold" currency={summary.currency} hidden={balancesHidden} /></dd></div></dl>
        </article>)}
      </div>
    </section>

    {!hasAccounts ? <section className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-serif text-2xl font-semibold">Empezá por una cuenta</h2><p className="mt-2 text-muted">Todavía no tenés cuentas personales para resumir.</p><Link className="mt-5 inline-flex rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground" href="/cuentas">Crear mi primera cuenta</Link></section> : null}

    <section aria-labelledby="cards-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl font-semibold" id="cards-heading">Tarjetas por pagar</h2><Link className="text-sm font-semibold text-signal hover:underline" href="/cuentas">Ver cuentas</Link></div>{creditCards.length === 0 ? <p className="rounded-2xl border border-border p-5 text-muted">No tenés tarjetas de crédito registradas.</p> : <ul className="grid gap-3 sm:grid-cols-2">{creditCards.map((card) => <li className="rounded-2xl border border-border bg-panel-raised p-5" key={card.id}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{card.institution} · Crédito</h3><p className="mt-1 text-sm text-muted">{card.name}</p></div><span className={card.currentBalance > 0 ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-signal"}>{card.currentBalance > 0 ? "Pendiente" : "Al día"}</span></div><MoneyValue amount={card.currentBalance} className="mt-5 block text-2xl font-semibold" currency={card.currency} hidden={balancesHidden} /></li>)}</ul>}</section>

    <section aria-labelledby="quick-actions-heading"><h2 className="font-serif text-2xl font-semibold" id="quick-actions-heading">Acciones rápidas</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Link className="rounded-2xl bg-brand p-5 font-semibold text-brand-foreground" href="/movimientos?tipo=expense">Registrar gasto</Link><Link className="rounded-2xl border border-border bg-panel p-5 font-semibold" href="/movimientos?tipo=income">Registrar ingreso</Link><Link className="rounded-2xl border border-border bg-panel p-5 font-semibold" href="/movimientos?tipo=card_payment">Pagar tarjeta</Link></div></section>

    <section aria-labelledby="recent-movements-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl font-semibold" id="recent-movements-heading">Últimos movimientos</h2><Link className="text-sm font-semibold text-signal hover:underline" href="/movimientos">Ver todos</Link></div>{ledger?.transactions.length ? <ul aria-label="Últimos movimientos personales" className="grid gap-2">{ledger.transactions.slice(0, 5).map((transaction) => <li className="flex items-center justify-between gap-4 rounded-xl border border-border bg-panel px-4 py-3" key={transaction.id}><div><p className="font-semibold">{transaction.category ?? transactionTitle(transaction, ledger.accounts)}</p><p className="mt-1 text-sm text-muted">{transactionTitle(transaction, ledger.accounts)} · {transaction.occurredOn}</p></div>{transaction.currency ? <MoneyValue amount={transaction.amount} className={transaction.operationType === "income" ? "font-semibold text-signal" : "font-semibold"} currency={transaction.currency} hidden={balancesHidden} /> : <span aria-label="Moneda no disponible" className="text-sm text-muted">—</span>}</li>)}</ul> : <p className="rounded-2xl border border-border p-5 text-muted">Todavía no registraste movimientos personales.</p>}</section>
  </div>;
}
