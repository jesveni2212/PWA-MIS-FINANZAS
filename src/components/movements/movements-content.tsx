"use client";

import { useCallback, useEffect, useState } from "react";
import { CreateMovementForm, FinancialSpace } from "@/components/movements/create-movement-form";
import { createClient } from "@/lib/supabase/client";

type Movement = {
  amount: number;
  category: string;
  id: string;
  kind: "income" | "expense";
  occurred_on: string;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(amount);
}

export function MovementsContent() {
  const [spaces, setSpaces] = useState<FinancialSpace[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    const client = createClient();
    const [{ data: spacesData, error: spacesError }, { data: movementsData, error: movementsError }] = await Promise.all([
      client.from("financial_spaces").select("id,name,kind").order("created_at", { ascending: true }),
      client.from("movements").select("id,amount,kind,occurred_on,category").order("occurred_on", { ascending: false }),
    ]);

    if (spacesError || movementsError) {
      setError(true);
      setSpaces([]);
      setMovements([]);
    } else {
      setSpaces((spacesData ?? []) as FinancialSpace[]);
      setMovements((movementsData ?? []) as Movement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  if (loading) return <p aria-live="polite">Cargando movimientos…</p>;

  if (error) {
    return (
      <div className="grid justify-items-start gap-3" role="status">
        <p>No pudimos cargar tus movimientos. Volvé a intentar.</p>
        <button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void loadData()} type="button">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <CreateMovementForm onCreated={loadData} spaces={spaces} />
      <section aria-labelledby="recent-movements-heading" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-bold" id="recent-movements-heading">Últimos movimientos</h2>
          <span className="text-sm text-muted">{movements.length} registrados</span>
        </div>
        {movements.length === 0 ? <p aria-live="polite">Todavía no registraste movimientos.</p> : (
          <ul aria-label="Lista de movimientos" className="grid gap-3">
            {movements.map((movement) => (
              <li className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3" key={movement.id}>
                <div><p className="font-semibold">{movement.category}</p><p className="text-sm text-muted">{movement.occurred_on}</p></div>
                <p className={movement.kind === "income" ? "font-bold text-brand" : "font-bold"}>{movement.kind === "income" ? "+" : "−"}{formatAmount(movement.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
