import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseItemEditor } from "@/components/movements/purchase-item-editor";
import type { PurchaseItemDraft } from "@/lib/finance/types";

function ControlledEditor({
  amount,
  initialItems,
  onChange,
}: {
  amount: number;
  initialItems: PurchaseItemDraft[];
  onChange: (items: PurchaseItemDraft[]) => void;
}) {
  const [items, setItems] = useState(initialItems);
  return (
    <PurchaseItemEditor
      amount={amount}
      items={items}
      onChange={(nextItems) => {
        setItems(nextItems);
        onChange(nextItems);
      }}
    />
  );
}

afterEach(cleanup);

describe("PurchaseItemEditor", () => {
  it("adds an item, calculates the total and warns when it differs", () => {
    const onChange = vi.fn();
    render(<ControlledEditor amount={15000} initialItems={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir ítem" }));
    fireEvent.change(screen.getByLabelText("Descripción del ítem 1"), { target: { value: "Leche" } });
    fireEvent.change(screen.getByLabelText("Cantidad del ítem 1"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Precio unitario del ítem 1"), { target: { value: "8500" } });

    expect(screen.getByText("Total de ítems: ₲ 17.000")).toBeInTheDocument();
    expect(screen.getByLabelText(/Precio unitario/)).toHaveValue("8.500");
    expect(screen.getByText(/no coincide/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([{ description: "Leche", quantity: "2", unitPrice: "8500" }]);
  });

  it("removes an item and never renders a file input", () => {
    const onChange = vi.fn();
    render(
      <ControlledEditor
        amount={1000}
        initialItems={[{ description: "Pan", quantity: "1", unitPrice: "1000" }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quitar ítem 1" }));

    expect(screen.queryByLabelText("Descripción del ítem 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /archivo|foto|imagen/i })).not.toBeInTheDocument();
  });
});
