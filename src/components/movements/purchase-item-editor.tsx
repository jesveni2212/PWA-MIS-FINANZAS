"use client";

import { ChangeEvent, useMemo } from "react";
import { MoneyInput } from "@/components/ui/money-input";
import { PurchaseItemDraft } from "@/lib/finance/types";

type PurchaseItemEditorProps = {
  items: PurchaseItemDraft[];
  onChange: (items: PurchaseItemDraft[]) => void;
  amount: number;
};

const currencyFormatter = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace(/^Gs\.\s?/, "₲ ");
}

function toNonNegativeNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function PurchaseItemEditor({ items, onChange, amount }: PurchaseItemEditorProps) {
  const total = useMemo(
    () => items.reduce((sum, item) => {
      const quantity = toNonNegativeNumber(item.quantity);
      const unitPrice = toNonNegativeNumber(item.unitPrice);
      return quantity === null || unitPrice === null ? sum : sum + quantity * unitPrice;
    }, 0),
    [items],
  );

  function updateItems(nextItems: PurchaseItemDraft[]) {
    onChange(nextItems);
  }

  function updateItem(index: number, field: keyof PurchaseItemDraft, event: ChangeEvent<HTMLInputElement>) {
    updateItems(items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: event.target.value } : item
    )));
  }

  return (
    <section className="grid gap-4" aria-label="Ítems de compra">
      <div className="grid gap-3">
        {items.map((item, index) => {
          const itemNumber = index + 1;
          return (
            <fieldset className="grid gap-3 rounded-2xl border border-border bg-surface p-4" key={itemNumber}>
              <legend className="font-semibold">Ítem {itemNumber}</legend>
              <label className="grid gap-2 text-sm font-semibold" htmlFor={`purchase-item-description-${itemNumber}`}>
                Descripción del ítem {itemNumber}
                <input
                  className="rounded-xl border border-border bg-background px-4 py-3"
                  id={`purchase-item-description-${itemNumber}`}
                  onChange={(event) => updateItem(index, "description", event)}
                  value={item.description}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold" htmlFor={`purchase-item-quantity-${itemNumber}`}>
                  Cantidad del ítem {itemNumber}
                  <input
                    className="rounded-xl border border-border bg-background px-4 py-3"
                    id={`purchase-item-quantity-${itemNumber}`}
                    min="0"
                    onChange={(event) => updateItem(index, "quantity", event)}
                    step="any"
                    type="number"
                    value={item.quantity}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold" htmlFor={`purchase-item-unit-price-${itemNumber}`}>
                  Precio unitario del ítem {itemNumber}
                  <MoneyInput
                    className="rounded-xl border border-border bg-background px-4 py-3"
                    id={`purchase-item-unit-price-${itemNumber}`}
                    min="0"
                    onChange={(value) => updateItems(items.map((currentItem, itemIndex) => (
                      itemIndex === index ? { ...currentItem, unitPrice: value } : currentItem
                    )))}
                    step="any"
                    value={item.unitPrice}
                  />
                </label>
              </div>
              <button
                className="w-fit rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                Quitar ítem {itemNumber}
              </button>
            </fieldset>
          );
        })}
      </div>
      <button
        className="w-fit rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground"
        onClick={() => updateItems([...items, { description: "", quantity: "", unitPrice: "" }])}
        type="button"
      >
        Añadir ítem
      </button>
      <p className="font-semibold">Total de ítems: {formatCurrency(total)}</p>
      {amount > 0 && total !== amount ? (
        <p aria-live="polite" className="text-amber-300">El total de ítems no coincide con el importe del movimiento.</p>
      ) : null}
    </section>
  );
}
