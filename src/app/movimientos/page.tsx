import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { MovementsContent } from "@/components/movements/movements-content";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";
import type { OperationType } from "@/lib/finance/types";

const operationTypes: OperationType[] = ["income", "expense", "card_purchase", "transfer", "card_payment"];

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<{ tipo?: string | string[] }> }) {
  const session = await getServerSessionData();
  if (!session) redirect("/acceso");

  const initialLedger = await loadPersonalLedgerServer(50);
  const tipo = (await searchParams).tipo;
  const initialOperationType = typeof tipo === "string" && operationTypes.includes(tipo as OperationType) ? tipo as OperationType : undefined;

  return (
    <PersonalFinanceProvider initialLedger={initialLedger} userId={session.userId}>
      <AppShell displayName={session.displayName}>
        <section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-12">
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Movimientos</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Registrá ingresos y gastos para mantener cada espacio en orden.
          </p>
          <div className="mt-10"><MovementsContent initialOperationType={initialOperationType} /></div>
        </section>
      </AppShell>
    </PersonalFinanceProvider>
  );
}
