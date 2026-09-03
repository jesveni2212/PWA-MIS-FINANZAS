import { AppShell } from "@/components/app-shell";
import { MovementsContent } from "@/components/movements/movements-content";
import type { OperationType } from "@/lib/finance/types";

const operationTypes: OperationType[] = ["income", "expense", "card_purchase", "transfer", "card_payment"];

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<{ tipo?: string | string[] }> }) {
  const tipo = (await searchParams).tipo;
  const initialOperationType = typeof tipo === "string" && operationTypes.includes(tipo as OperationType) ? tipo as OperationType : undefined;
  return (
    <AppShell>
      <section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-12">
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Movimientos</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
          Registrá ingresos y gastos para mantener cada espacio en orden.
        </p>
        <div className="mt-10"><MovementsContent initialOperationType={initialOperationType} /></div>
      </section>
    </AppShell>
  );
}
