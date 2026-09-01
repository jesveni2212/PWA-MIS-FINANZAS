"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FinancialSpace = {
  id: string;
  kind: "personal" | "shared";
  name: string;
};

type CreateMovementFormProps = {
  spaces: FinancialSpace[];
  onCreated?: () => void | Promise<void>;
};

export function CreateMovementForm({ spaces, onCreated }: CreateMovementFormProps) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCategory = category.trim();
    const numericAmount = Number(amount);

    if (!spaceId || !normalizedCategory || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Completá el espacio, importe y categoría con valores válidos.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    const client = createClient();
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError || !authData.user) {
      setSubmitting(false);
      setMessage("Tu sesión no está disponible. Volvé a iniciar sesión e intentá de nuevo.");
      return;
    }

    const { error } = await client.from("movements").insert({
      space_id: spaceId,
      created_by: authData.user.id,
      kind,
      amount: numericAmount,
      occurred_on: occurredOn,
      category: normalizedCategory,
      note: note.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      setMessage("No pudimos guardar el movimiento. Verificá los datos e intentá de nuevo.");
      return;
    }

    setAmount("");
    setCategory("");
    setNote("");
    setMessage("Movimiento guardado.");
    await onCreated?.();
  }

  if (spaces.length === 0) {
    return <p aria-live="polite">No encontramos espacios financieros disponibles.</p>;
  }

  return (
    <form className="grid gap-5 rounded-2xl border border-border bg-background/60 p-5" onSubmit={handleSubmit}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold">Registrar movimiento</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Al día</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="movement-space">Espacio
          <select className="rounded-xl border border-border bg-surface px-4 py-3" id="movement-space" onChange={(event) => setSpaceId(event.target.value)} value={spaceId}>
            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name} · {space.kind === "personal" ? "personal" : "compartido"}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold" htmlFor="movement-kind">Tipo
          <select className="rounded-xl border border-border bg-surface px-4 py-3" id="movement-kind" onChange={(event) => setKind(event.target.value as "income" | "expense")} value={kind}>
            <option value="expense">Gasto</option><option value="income">Ingreso</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold" htmlFor="movement-amount">Importe
          <input className="rounded-xl border border-border bg-surface px-4 py-3" id="movement-amount" inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder="0" required step="0.01" type="number" value={amount} />
        </label>
        <label className="grid gap-2 text-sm font-semibold" htmlFor="movement-date">Fecha
          <input className="rounded-xl border border-border bg-surface px-4 py-3" id="movement-date" onChange={(event) => setOccurredOn(event.target.value)} required type="date" value={occurredOn} />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="movement-category">Categoría
        <input className="rounded-xl border border-border bg-surface px-4 py-3" id="movement-category" onChange={(event) => setCategory(event.target.value)} placeholder="Ej.: Alimentación" required value={category} />
      </label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="movement-note">Nota <span className="font-normal text-muted">(opcional)</span>
        <textarea className="min-h-24 rounded-xl border border-border bg-surface px-4 py-3" id="movement-note" onChange={(event) => setNote(event.target.value)} placeholder="Un detalle para recordar" value={note} />
      </label>
      {message ? <p aria-live="polite" className={message === "Movimiento guardado." ? "text-brand" : "text-red-700"}>{message}</p> : null}
      <button className="w-fit rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting} type="submit">{submitting ? "Guardando…" : "Guardar movimiento"}</button>
    </form>
  );
}
