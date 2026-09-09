"use client";

import { FormEvent, useMemo, useState } from "react";
import { PurchaseItemEditor } from "@/components/movements/purchase-item-editor";
import { MoneyInput } from "@/components/ui/money-input";
import { recordPersonalTransaction } from "@/lib/finance/personal-ledger";
import type { OperationType, PersonalAccount, PersonalTransactionDraft, PurchaseItemDraft } from "@/lib/finance/types";

const operationTypes: OperationType[] = ["income", "expense", "card_purchase", "transfer", "card_payment"];
const labels: Record<OperationType, string> = { income: "Ingreso", expense: "Gasto", card_purchase: "Compra con tarjeta", transfer: "Transferencia", card_payment: "Pago de tarjeta" };
const saveError = "No pudimos guardar la operación. Revisá los datos e intentá de nuevo.";
type Props = { accounts: PersonalAccount[]; initialOperationType?: OperationType; onCreated?: () => void | Promise<void> };

export function OperationForm({ accounts, initialOperationType, onCreated }: Props) {
  const [operationType, setOperationType] = useState<OperationType>(initialOperationType && operationTypes.includes(initialOperationType) ? initialOperationType : "expense");
  const [source, setSource] = useState(""); const [destination, setDestination] = useState(""); const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)); const [category, setCategory] = useState(""); const [note, setNote] = useState(""); const [merchant, setMerchant] = useState("");
  const [items, setItems] = useState<PurchaseItemDraft[]>([]); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const available = useMemo(() => accounts.filter((account) => account.accountType !== "credit_card"), [accounts]);
  const cards = useMemo(() => accounts.filter((account) => account.accountType === "credit_card"), [accounts]);
  const categoryNeeded = operationType === "income" || operationType === "expense" || operationType === "card_purchase";
  const purchase = operationType === "expense" || operationType === "card_purchase";

  const select = (label: string, value: string, change: (value: string) => void, options: PersonalAccount[]) => <label className="grid gap-2 text-sm font-semibold" htmlFor={`operation-${label}`}>
    {label}<select className="rounded-xl border border-border bg-surface px-4 py-3" id={`operation-${label}`} value={value} onChange={(event) => change(event.target.value)}><option value="">Seleccioná una cuenta</option>{options.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
  </label>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !date) { setMessage(saveError); return; }
    setSaving(true); setMessage("");
    const draft: PersonalTransactionDraft = { operationType, sourceAccountId: operationType === "income" ? null : source || null, destinationAccountId: operationType === "expense" || operationType === "card_purchase" ? null : destination || null, amount: numericAmount, occurredOn: date, category: categoryNeeded ? category.trim() || null : null, note: note.trim() || null, merchant: purchase ? merchant.trim() || null : null, ...(purchase ? { items } : {}) };
    try { await recordPersonalTransaction(draft, accounts); setSource(""); setDestination(""); setAmount(""); setDate(new Date().toISOString().slice(0, 10)); setCategory(""); setNote(""); setMerchant(""); setItems([]); setMessage("Operación guardada."); await onCreated?.(); }
    catch (error) { setMessage(error instanceof Error && error.message ? error.message : saveError); }
    finally { setSaving(false); }
  }

  const sourceLabel = operationType === "expense" ? "Cuenta de origen disponible" : operationType === "card_payment" ? "Cuenta desde la que pagás" : "Cuenta de origen";
  const destinationLabel = operationType === "income" ? "Cuenta de destino disponible" : operationType === "card_payment" ? "Tarjeta que pagás" : "Cuenta de destino disponible";
  return <form className="grid gap-5 rounded-2xl border border-border bg-background/60 p-5" onSubmit={submit}>
    <h2 className="text-xl font-bold">Registrar operación</h2>
    <label className="grid gap-2 text-sm font-semibold" htmlFor="operation-type">Tipo de operación<select className="rounded-xl border border-border bg-surface px-4 py-3" id="operation-type" value={operationType} onChange={(event) => { setOperationType(event.target.value as OperationType); setSource(""); setDestination(""); }}>{operationTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}</select></label>
    {operationType === "income" && select(destinationLabel, destination, setDestination, available)}
    {(operationType === "expense" || operationType === "transfer" || operationType === "card_payment") && select(sourceLabel, source, setSource, available)}
    {operationType === "transfer" && select(destinationLabel, destination, setDestination, available)}
    {operationType === "card_purchase" && select("Tarjeta de crédito", source, setSource, cards)}
    {operationType === "card_payment" && select(destinationLabel, destination, setDestination, cards)}
    <label className="grid gap-2 text-sm font-semibold" htmlFor="operation-amount">Importe<MoneyInput className="rounded-xl border border-border bg-surface px-4 py-3" id="operation-amount" min="0.01" onChange={setAmount} step="0.01" value={amount} /></label>
    {categoryNeeded && <label className="grid gap-2 text-sm font-semibold" htmlFor="operation-category">Categoría<input className="rounded-xl border border-border bg-surface px-4 py-3" id="operation-category" value={category} onChange={(event) => setCategory(event.target.value)} /></label>}
    <label className="grid gap-2 text-sm font-semibold" htmlFor="operation-date">Fecha<input className="rounded-xl border border-border bg-surface px-4 py-3" id="operation-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <label className="grid gap-2 text-sm font-semibold" htmlFor="operation-note">Nota <span className="font-normal text-muted">(opcional)</span><textarea className="min-h-24 rounded-xl border border-border bg-surface px-4 py-3" id="operation-note" value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {purchase && <><label className="grid gap-2 text-sm font-semibold" htmlFor="operation-merchant">Comercio <span className="font-normal text-muted">(opcional)</span><input className="rounded-xl border border-border bg-surface px-4 py-3" id="operation-merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label><PurchaseItemEditor amount={Number.isFinite(Number(amount)) ? Number(amount) : 0} items={items} onChange={setItems} /></>}
    {message && <p aria-live="polite">{message}</p>}<button className="w-fit rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar operación"}</button>
  </form>;
}
