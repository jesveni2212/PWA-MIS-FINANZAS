"use client";

import { type FormEvent, useState } from "react";
import { PARAGUAYAN_INSTITUTIONS } from "@/lib/finance/institutions";
import type { AccountType } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";

type AccountFormProps = { onCreated?: () => void | Promise<void> };

const accountKinds: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "bank", label: "Cuenta disponible" },
  { value: "credit_card", label: "Tarjeta de crédito" },
];

export function AccountForm({ onCreated }: AccountFormProps) {
  const [accountType, setAccountType] = useState<AccountType>("cash");
  const [institution, setInstitution] = useState("Ueno");
  const [otherInstitution, setOtherInstitution] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"PYG" | "USD">("PYG");
  const [openingValue, setOpeningValue] = useState("0");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isCreditCard = accountType === "credit_card";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedInstitution = (institution === "Otro" ? otherInstitution : institution).trim();
    const numericOpeningValue = Number(openingValue);
    if (!normalizedName || !normalizedInstitution || !Number.isFinite(numericOpeningValue) || numericOpeningValue < 0) {
      setMessage("Completá el nombre, entidad y valor inicial con datos válidos.");
      return;
    }

    setSaving(true);
    setMessage("");
    const client = createClient();
    const { data: personalSpace, error: spaceError } = await client.from("financial_spaces").select("id").eq("kind", "personal").maybeSingle();
    if (spaceError || !personalSpace) {
      setSaving(false);
      setMessage("No encontramos tu espacio personal. Volvé a intentar.");
      return;
    }

    const { error } = await client.from("accounts").insert({
      space_id: personalSpace.id,
      account_type: accountType,
      institution: normalizedInstitution,
      name: normalizedName,
      currency,
      initial_balance: isCreditCard ? 0 : numericOpeningValue,
      opening_debt: isCreditCard ? numericOpeningValue : 0,
    });
    setSaving(false);
    if (error) {
      setMessage("No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.");
      return;
    }

    setName("");
    setOtherInstitution("");
    setOpeningValue("0");
    setMessage("Cuenta creada.");
    await onCreated?.();
  }

  return <form className="grid gap-5 rounded-2xl border border-border bg-panel p-5 sm:p-6" onSubmit={handleSubmit}>
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">Nueva cuenta</p><h2 className="mt-2 font-serif text-2xl font-semibold">Dónde guardás o debés dinero</h2></div>
    <fieldset className="grid gap-3"><legend className="text-sm font-semibold">Tipo de cuenta</legend><div className="grid gap-2 sm:grid-cols-3">{accountKinds.map((kind) => <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-semibold has-[:checked]:border-signal has-[:checked]:bg-brand-soft" key={kind.value}><input checked={accountType === kind.value} name="account-type" onChange={() => setAccountType(kind.value)} type="radio" value={kind.value} />{kind.label}</label>)}</div></fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold" htmlFor="account-name">Nombre<input className="rounded-xl border border-border bg-background px-4 py-3" id="account-name" onChange={(event) => setName(event.target.value)} placeholder={isCreditCard ? "Ej.: Visa" : "Ej.: Efectivo"} required value={name} /></label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="account-institution">Entidad<select className="rounded-xl border border-border bg-background px-4 py-3" id="account-institution" onChange={(event) => setInstitution(event.target.value)} value={institution}>{PARAGUAYAN_INSTITUTIONS.map((item) => <option key={item} value={item}>{item}</option>)}<option value="Otro">Otro</option></select></label>
      {institution === "Otro" ? <label className="grid gap-2 text-sm font-semibold sm:col-span-2" htmlFor="account-other-institution">Nombre de otra entidad<input className="rounded-xl border border-border bg-background px-4 py-3" id="account-other-institution" onChange={(event) => setOtherInstitution(event.target.value)} placeholder="Ej.: Cooperativa local" required value={otherInstitution} /></label> : null}
      <label className="grid gap-2 text-sm font-semibold" htmlFor="account-currency">Moneda<select className="rounded-xl border border-border bg-background px-4 py-3" id="account-currency" onChange={(event) => setCurrency(event.target.value as "PYG" | "USD")} value={currency}><option value="PYG">Guaraníes (PYG)</option><option value="USD">Dólares (USD)</option></select></label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="account-opening-value">{isCreditCard ? "Deuda inicial" : "Saldo inicial"}<input className="rounded-xl border border-border bg-background px-4 py-3" id="account-opening-value" inputMode="decimal" min="0" onChange={(event) => setOpeningValue(event.target.value)} step="0.01" type="number" value={openingValue} /></label>
    </div>
    {message ? <p aria-live="polite" className={message === "Cuenta creada." ? "text-signal" : "text-danger"}>{message}</p> : null}
    <button className="w-fit rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={saving} type="submit">{saving ? "Guardando…" : "Crear cuenta"}</button>
  </form>;
}
