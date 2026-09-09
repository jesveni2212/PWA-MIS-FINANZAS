import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoneyInput } from "@/components/ui/money-input";

afterEach(cleanup);

function ControlledMoneyInput({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <MoneyInput aria-label="Importe" onChange={(nextValue) => { setValue(nextValue); onChange(nextValue); }} value={value} />;
}

describe("MoneyInput", () => {
  it("shows grouping and emits the canonical decimal value", () => {
    const onChange = vi.fn();
    render(<ControlledMoneyInput onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Importe" });
    fireEvent.change(input, { target: { value: "500000" } });
    expect(input).toHaveValue("500.000");
    expect(onChange).toHaveBeenLastCalledWith("500000");

    fireEvent.change(input, { target: { value: "50.000,25" } });
    expect(input).toHaveValue("50.000,25");
    expect(onChange).toHaveBeenLastCalledWith("50000.25");
  });
});
