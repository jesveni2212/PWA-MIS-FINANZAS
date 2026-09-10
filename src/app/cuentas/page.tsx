import { redirect } from "next/navigation";

import { AccountsContent } from "@/components/accounts/accounts-content";
import { AppShell } from "@/components/app-shell";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";
import type { PersonalLedger } from "@/lib/finance/types";

export default async function CuentasPage() {
  const session = await getServerSessionData();
  if (!session) redirect("/acceso");

  let initialLedger: PersonalLedger = { accounts: [], transactions: [] };
  let initialLedgerUpdatedAt: string | null = null;
  try {
    initialLedger = await loadPersonalLedgerServer(50);
    initialLedgerUpdatedAt = new Date().toISOString();
  } catch {
    // The client provider may safely recover from its per-user IndexedDB cache.
  }

  return (
    <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt={initialLedgerUpdatedAt} userId={session.userId}>
      <AppShell avatarPath={session.avatarPath} displayName={session.displayName}>
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Libro personal</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Cuentas y tarjetas</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg">Organizá tu disponible y tus deudas sin mezclar los grupos compartidos.</p>
          <div className="mt-10"><AccountsContent /></div>
        </section>
      </AppShell>
    </PersonalFinanceProvider>
  );
}
