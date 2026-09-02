import { MoneyValue } from "@/components/ui/money-value";
import type { PersonalAccount } from "@/lib/finance/types";

type AccountCardProps = { account: PersonalAccount; hidden: boolean };

export function AccountCard({ account, hidden }: AccountCardProps) {
  const isCreditCard = account.accountType === "credit_card";
  const label = isCreditCard ? "Tarjeta de crédito" : account.accountType === "cash" ? "Efectivo disponible" : "Cuenta disponible";
  return <article className="flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-panel-raised p-5 shadow-lg shadow-black/10"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p><h3 className="mt-2 text-lg font-semibold">{account.institution} · {account.name}</h3></div><span className={isCreditCard ? "rounded-full bg-danger/15 px-2 py-1 text-xs font-semibold text-danger" : "rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-signal"}>{isCreditCard ? "Deuda" : "Disponible"}</span></div><div className="mt-5 flex items-end justify-between gap-3"><p className="text-sm text-muted">{isCreditCard ? "Por pagar" : "Saldo actual"}</p><MoneyValue amount={account.currentBalance} className="text-xl font-semibold tracking-tight" currency={account.currency} hidden={hidden} /></div></article>;
}
