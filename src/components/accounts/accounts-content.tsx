"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountForm } from "@/components/accounts/account-form";
import { useBalancesHidden } from "@/components/app-shell";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalAccount } from "@/lib/finance/types";

export function AccountsContent() {
  const balancesHidden = useBalancesHidden();
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadAccounts = useCallback(async () => {
    setLoading(true); setError(false);
    try { setAccounts((await loadPersonalLedger()).accounts); } catch { setAccounts([]); setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timeoutId = window.setTimeout(() => void loadAccounts(), 0); return () => window.clearTimeout(timeoutId); }, [loadAccounts]);
  if (loading) return <p aria-live="polite">Cargando cuentas personales…</p>;
  if (error) return <div className="grid justify-items-start gap-3" role="status"><p>No pudimos cargar tus cuentas. Volvé a intentar.</p><button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void loadAccounts()} type="button">Reintentar</button></div>;
  const available = accounts.filter((account) => account.accountType !== "credit_card");
  const creditCards = accounts.filter((account) => account.accountType === "credit_card");
  return <div className="grid gap-10"><AccountForm onCreated={loadAccounts} />
    <section aria-labelledby="available-accounts-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-3"><h2 className="font-serif text-2xl font-semibold" id="available-accounts-heading">Disponible</h2><span className="text-sm text-muted">{available.length} cuentas</span></div>{available.length ? <ul className="grid gap-3 sm:grid-cols-2">{available.map((account) => <li key={account.id}><AccountCard account={account} hidden={balancesHidden} /></li>)}</ul> : <p className="rounded-2xl border border-border p-5 text-muted">Todavía no creaste cuentas disponibles.</p>}</section>
    <section aria-labelledby="credit-accounts-heading" className="grid gap-4"><div className="flex items-baseline justify-between gap-3"><h2 className="font-serif text-2xl font-semibold" id="credit-accounts-heading">Tarjetas de crédito</h2><span className="text-sm text-muted">{creditCards.length} tarjetas</span></div>{creditCards.length ? <ul className="grid gap-3 sm:grid-cols-2">{creditCards.map((account) => <li key={account.id}><AccountCard account={account} hidden={balancesHidden} /></li>)}</ul> : <p className="rounded-2xl border border-border p-5 text-muted">Todavía no registraste tarjetas de crédito.</p>}</section>
  </div>;
}
