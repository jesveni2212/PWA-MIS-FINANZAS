"use client";

import { useCallback, useState } from "react";

import { useBalancesHidden } from "@/components/app-shell";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountForm } from "@/components/accounts/account-form";
import { usePersonalFinance } from "@/components/finance/personal-finance-provider";

export function AccountsContent() {
  const balancesHidden = useBalancesHidden();
  const { ledger, refresh } = usePersonalFinance();
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const reloadAccounts = useCallback(async () => {
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
  const available = accounts.filter((account) => account.accountType !== "credit_card");
  const creditCards = accounts.filter((account) => account.accountType === "credit_card");

  return <div className="grid gap-10">
    {error ? <div className="grid justify-items-start gap-3" role="status"><p>No pudimos actualizar tus cuentas. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-60" disabled={refreshing} onClick={() => void reloadAccounts()} type="button">Reintentar</button></div> : null}
    <AccountForm onCreated={reloadAccounts} />
    <section aria-labelledby="available-accounts-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-3"><h2 className="font-serif text-2xl font-semibold" id="available-accounts-heading">Disponible</h2><span className="text-sm text-muted">{available.length} cuentas</span></div>{available.length ? <ul className="grid gap-3 sm:grid-cols-2">{available.map((account) => <li key={account.id}><AccountCard account={account} hidden={balancesHidden} /></li>)}</ul> : <p className="rounded-2xl border border-border p-5 text-muted">Todavía no creaste cuentas disponibles.</p>}</section>
    <section aria-labelledby="credit-accounts-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-3"><h2 className="font-serif text-2xl font-semibold" id="credit-accounts-heading">Tarjetas de crédito</h2><span className="text-sm text-muted">{creditCards.length} tarjetas</span></div>{creditCards.length ? <ul className="grid gap-3 sm:grid-cols-2">{creditCards.map((account) => <li key={account.id}><AccountCard account={account} hidden={balancesHidden} /></li>)}</ul> : <p className="rounded-2xl border border-border p-5 text-muted">Todavía no registraste tarjetas de crédito.</p>}</section>
  </div>;
}
