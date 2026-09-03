"use client";

import { useCallback, useEffect, useState } from "react";
import { useBalancesHidden } from "@/components/app-shell";
import { OperationForm } from "@/components/movements/operation-form";
import { TransactionDetail, transactionTitle } from "@/components/movements/transaction-detail";
import { MoneyValue } from "@/components/ui/money-value";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { OperationType, PersonalLedger } from "@/lib/finance/types";

type Props = { initialOperationType?: OperationType };
export function MovementsContent({ initialOperationType }: Props) {
  const balancesHidden = useBalancesHidden();
  const [ledger, setLedger] = useState<PersonalLedger | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const loadData = useCallback(async () => { setLoading(true); setError(false); try { setLedger(await loadPersonalLedger()); } catch { setLedger(null); setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { const timeoutId = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timeoutId); }, [loadData]);
  if (loading) return <p aria-live="polite">Cargando movimientos personales…</p>;
  if (error) return <div className="grid justify-items-start gap-3" role="status"><p>No pudimos cargar tus movimientos personales. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void loadData()} type="button">Reintentar</button></div>;
  const accounts = ledger?.accounts ?? []; const transactions = ledger?.transactions ?? [];
  return <div className="grid gap-10"><OperationForm accounts={accounts} initialOperationType={initialOperationType} onCreated={loadData} /><section aria-labelledby="recent-movements-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-4"><h2 className="font-serif text-2xl font-semibold" id="recent-movements-heading">Últimos movimientos</h2><span className="text-sm text-muted">{transactions.length} registrados</span></div>{transactions.length === 0 ? <p aria-live="polite" className="rounded-2xl border border-dashed border-border p-5 text-muted">Todavía no registraste movimientos personales.</p> : <ul aria-label="Lista de movimientos personales" className="grid gap-3">{transactions.map((transaction) => <li className="rounded-2xl border border-border bg-panel p-4" key={transaction.id}><details><summary className="flex cursor-pointer list-none items-center justify-between gap-4"><div><p className="font-semibold">{transactionTitle(transaction, accounts)}</p><p className="mt-1 text-sm text-muted">{transaction.category ?? transaction.occurredOn}</p></div><MoneyValue amount={transaction.amount} className={transaction.operationType === "income" ? "font-semibold text-signal" : "font-semibold"} currency={transaction.currency ?? "PYG"} hidden={balancesHidden} /></summary><TransactionDetail accounts={accounts} hidden={balancesHidden} transaction={transaction} /></details></li>)}</ul>}</section></div>;
}
