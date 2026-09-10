"use client";

import { useCallback, useState } from "react";

import { useBalancesHidden } from "@/components/app-shell";
import { usePersonalFinance } from "@/components/finance/personal-finance-provider";
import { OperationForm } from "@/components/movements/operation-form";
import { TransactionDetail, transactionTitle } from "@/components/movements/transaction-detail";
import { MoneyValue } from "@/components/ui/money-value";
import type { OperationType } from "@/lib/finance/types";

type Props = { initialOperationType?: OperationType };

export function MovementsContent({ initialOperationType }: Props) {
  const balancesHidden = useBalancesHidden();
  const { ledger, refresh } = usePersonalFinance();
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const retry = useCallback(async () => {
    setRefreshing(true);
    setError(false);
    try {
      await refresh();
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const accounts = ledger.accounts;
  const transactions = ledger.transactions;
  return <div className="grid gap-10">
    {error ? <div className="grid justify-items-start gap-3" role="status"><p>No pudimos actualizar tus movimientos personales. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-60" disabled={refreshing} onClick={() => void retry()} type="button">Reintentar</button></div> : null}
    <OperationForm accounts={accounts} initialOperationType={initialOperationType} />
    <section aria-labelledby="recent-movements-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl font-semibold" id="recent-movements-heading">Últimos movimientos</h2><span className="text-sm text-muted">{transactions.length} registrados</span></div>{transactions.length === 0 ? <p aria-live="polite" className="rounded-2xl border border-dashed border-border p-5 text-muted">Todavía no registraste movimientos personales.</p> : <ul aria-label="Lista de movimientos personales" className="grid gap-3">{transactions.map((transaction) => <li className="rounded-2xl border border-border bg-panel p-4" key={transaction.id}><details><summary className="flex cursor-pointer list-none items-center justify-between gap-4"><div><p className="font-semibold">{transactionTitle(transaction, accounts)}</p><p className="mt-1 text-sm text-muted">{transaction.category ?? transaction.occurredOn}</p></div><div className="grid justify-items-end gap-1">{transaction.syncStatus ? <span className={transaction.syncStatus === "review" ? "text-xs font-semibold text-danger" : "text-xs font-semibold text-signal"}>{transaction.syncStatus === "review" ? "Revisar" : "Pendiente"}</span> : null}<MoneyValue amount={transaction.amount} className={transaction.operationType === "income" ? "font-semibold text-signal" : "font-semibold"} currency={transaction.currency ?? "PYG"} hidden={balancesHidden} /></div></summary><TransactionDetail accounts={accounts} hidden={balancesHidden} transaction={transaction} /></details></li>)}</ul>}</section>
  </div>;
}
