import { redirect } from "next/navigation";

import { AccountsContent } from "@/components/accounts/accounts-content";
import { AppShell } from "@/components/app-shell";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";

export default async function CuentasPage() {
  const session = await getServerSessionData();
  if (!session) redirect("/acceso");

  const initialLedger = await loadPersonalLedgerServer(50);

  return (
    <PersonalFinanceProvider initialLedger={initialLedger} userId={session.userId}>
      <AppShell displayName={session.displayName}>
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
