"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBalancesHidden } from "@/components/app-shell";
import { MoneyValue } from "@/components/ui/money-value";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalAccount, PersonalLedger, PersonalTransaction } from "@/lib/finance/types";

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

export function PersonalDashboard() {
  const balancesHidden = useBalancesHidden();
  const [ledger, setLedger] = useState<PersonalLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try { setLedger(await loadPersonalLedger()); } catch { setLedger(null); setError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const summary = useMemo(() => {
    const accounts = ledger?.accounts ?? [];
    const availableTotal = accounts.filter((account) => account.accountType !== "credit_card").reduce((total, account) => total + account.currentBalance, 0);
    const creditDebtTotal = accounts.filter((account) => account.accountType === "credit_card").reduce((total, account) => total + account.currentBalance, 0);
    return { availableTotal, creditDebtTotal, netWorth: availableTotal - creditDebtTotal, creditCards: accounts.filter((account) => account.accountType === "credit_card") };
  }, [ledger]);

  if (loading) return <p aria-live="polite">Cargando resumen personal…</p>;
  if (error) return <div className="grid justify-items-start gap-3" role="status"><p>No pudimos cargar tus finanzas personales. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void load()} type="button">Reintentar</button></div>;

  const hasAccounts = (ledger?.accounts.length ?? 0) > 0;
  return <div className="grid gap-8">
    <section aria-labelledby="net-worth-heading" className="overflow-hidden rounded-[2rem] border border-border bg-panel p-6 shadow-2xl shadow-black/15 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Resumen personal</p><h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl" id="net-worth-heading">Patrimonio neto</h1>
      <MoneyValue amount={summary.netWorth} className="mt-5 block text-4xl font-semibold tracking-tight text-signal sm:text-6xl" currency="PYG" hidden={balancesHidden} />
      <div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border bg-background/45 p-4"><p className="text-sm text-muted">Disponible</p><MoneyValue amount={summary.availableTotal} className="mt-2 block text-xl font-semibold" currency="PYG" hidden={balancesHidden} /></div><div className="rounded-2xl border border-border bg-background/45 p-4"><p className="text-sm text-muted">Deuda de tarjetas</p><MoneyValue amount={summary.creditDebtTotal} className="mt-2 block text-xl font-semibold" currency="PYG" hidden={balancesHidden} /></div></div>
    </section>

    {!hasAccounts ? <section className="rounded-2xl border border-dashed border-border p-6"><h2 className="font-serif text-2xl font-semibold">Empezá por una cuenta</h2><p className="mt-2 text-muted">Todavía no tenés cuentas personales para resumir.</p><Link className="mt-5 inline-flex rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground" href="/cuentas">Crear mi primera cuenta</Link></section> : null}

    <section aria-labelledby="cards-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl font-semibold" id="cards-heading">Tarjetas por pagar</h2><Link className="text-sm font-semibold text-signal hover:underline" href="/cuentas">Ver cuentas</Link></div>{summary.creditCards.length === 0 ? <p className="rounded-2xl border border-border p-5 text-muted">No tenés tarjetas de crédito registradas.</p> : <ul className="grid gap-3 sm:grid-cols-2">{summary.creditCards.map((card) => <li className="rounded-2xl border border-border bg-panel-raised p-5" key={card.id}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{card.institution} · Crédito</h3><p className="mt-1 text-sm text-muted">{card.name}</p></div><span className={card.currentBalance > 0 ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-signal"}>{card.currentBalance > 0 ? "Pendiente" : "Al día"}</span></div><MoneyValue amount={card.currentBalance} className="mt-5 block text-2xl font-semibold" currency={card.currency} hidden={balancesHidden} /></li>)}</ul>}</section>

    <section aria-labelledby="quick-actions-heading"><h2 className="font-serif text-2xl font-semibold" id="quick-actions-heading">Acciones rápidas</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Link className="rounded-2xl bg-brand p-5 font-semibold text-brand-foreground" href="/movimientos?tipo=expense">Registrar gasto</Link><Link className="rounded-2xl border border-border bg-panel p-5 font-semibold" href="/movimientos?tipo=income">Registrar ingreso</Link><Link className="rounded-2xl border border-border bg-panel p-5 font-semibold" href="/movimientos?tipo=card_payment">Pagar tarjeta</Link></div></section>

    <section aria-labelledby="recent-movements-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl font-semibold" id="recent-movements-heading">Últimos movimientos</h2><Link className="text-sm font-semibold text-signal hover:underline" href="/movimientos">Ver todos</Link></div>{ledger?.transactions.length ? <ul aria-label="Últimos movimientos personales" className="grid gap-2">{ledger.transactions.slice(0, 5).map((transaction) => <li className="flex items-center justify-between gap-4 rounded-xl border border-border bg-panel px-4 py-3" key={transaction.id}><div><p className="font-semibold">{transaction.category ?? transactionTitle(transaction, ledger.accounts)}</p><p className="mt-1 text-sm text-muted">{transactionTitle(transaction, ledger.accounts)} · {transaction.occurredOn}</p></div><MoneyValue amount={transaction.amount} className={transaction.operationType === "income" ? "font-semibold text-signal" : "font-semibold"} currency="PYG" hidden={balancesHidden} /></li>)}</ul> : <p className="rounded-2xl border border-border p-5 text-muted">Todavía no registraste movimientos personales.</p>}</section>
  </div>;
}
