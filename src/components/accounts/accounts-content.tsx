"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Account = { id: string; name: string; currency: "PYG" | "USD"; initial_balance: number };

export function AccountsContent() {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"PYG" | "USD">("PYG");
  const [initialBalance, setInitialBalance] = useState("0");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const client = createClient();
    const { data: space, error: spaceError } = await client.from("financial_spaces").select("id").eq("kind", "personal").maybeSingle();
    if (spaceError || !space) { setMessage("No encontramos tu espacio personal."); setLoading(false); return; }
    setSpaceId(space.id);
    const { data, error } = await client.from("accounts").select("id,name,currency,initial_balance").eq("space_id", space.id).order("created_at", { ascending: true });
    if (error) setMessage("No pudimos cargar tus cuentas. Intentá de nuevo.");
    else setAccounts((data ?? []) as Account[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadAccounts]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const balance = Number(initialBalance);
    if (!spaceId || !normalizedName || !Number.isFinite(balance)) { setMessage("Completá el nombre y saldo inicial con valores válidos."); return; }
    setSaving(true); setMessage("");
    const { error } = await createClient().from("accounts").insert({ space_id: spaceId, name: normalizedName, currency, initial_balance: balance });
    setSaving(false);
    if (error) { setMessage("No pudimos crear la cuenta. Revisá los datos e intentá de nuevo."); return; }
    setName(""); setInitialBalance("0"); setMessage("Cuenta creada."); await loadAccounts();
  }

  if (loading) return <p aria-live="polite">Cargando cuentas…</p>;
  return <div className="grid gap-10">
    <form className="grid max-w-lg gap-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-semibold">Nombre<input className="rounded-xl border border-border bg-background px-4 py-3" onChange={(event) => setName(event.target.value)} placeholder="Ej.: Efectivo" required value={name} /></label>
      <label className="grid gap-2 text-sm font-semibold">Moneda<select className="rounded-xl border border-border bg-background px-4 py-3" onChange={(event) => setCurrency(event.target.value as "PYG" | "USD")} value={currency}><option value="PYG">PYG</option><option value="USD">USD</option></select></label>
      <label className="grid gap-2 text-sm font-semibold">Saldo inicial<input className="rounded-xl border border-border bg-background px-4 py-3" inputMode="decimal" onChange={(event) => setInitialBalance(event.target.value)} step="0.01" type="number" value={initialBalance} /></label>
      {message ? <p aria-live="polite">{message}</p> : null}
      <button className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Guardando…" : "Crear cuenta"}</button>
    </form>
    <section aria-labelledby="accounts-heading"><h2 className="text-2xl font-bold" id="accounts-heading">Mis cuentas</h2>{accounts.length === 0 ? <p className="mt-4">Todavía no creaste cuentas.</p> : <ul className="mt-4 grid gap-3">{accounts.map((account) => <li className="rounded-xl border border-border px-4 py-3" key={account.id}><p className="font-semibold">{account.name}</p><p className="text-sm text-muted">{account.currency} · Saldo inicial: {account.initial_balance}</p></li>)}</ul>}</section>
  </div>;
}
