import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountForm } from "@/components/accounts/account-form";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  mockedCreateClient.mockReset();
});

describe("AccountForm", () => {
  it("keeps account creation online-only", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<AccountForm />);

    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
    expect(await screen.findByText("Necesitás conexión para crear una cuenta")).toBeInTheDocument();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("reveals the credit-card debt and custom institution fields", () => {
    render(<AccountForm />);

    fireEvent.click(screen.getByRole("radio", { name: "Tarjeta de crédito" }));
    fireEvent.change(screen.getByLabelText("Entidad"), { target: { value: "Otro" } });

    expect(screen.getByLabelText("Nombre de otra entidad")).toBeVisible();
    expect(screen.getByLabelText("Deuda inicial")).toBeVisible();
  });

  it("inserts into the authenticated personal space only", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "personal-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockedCreateClient.mockReturnValue({
      from: vi.fn((table: string) => table === "financial_spaces" ? { select } : { insert }),
    } as never);

    render(<AccountForm />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: " Efectivo " } });
    fireEvent.change(screen.getByLabelText("Saldo inicial"), { target: { value: "500000" } });
    expect(screen.getByLabelText("Saldo inicial")).toHaveValue("500.000");
    fireEvent.submit(screen.getByRole("button", { name: "Crear cuenta" }).closest("form")!);

    expect(await screen.findByText("Cuenta creada.")).toBeInTheDocument();
    expect(eq).toHaveBeenCalledWith("kind", "personal");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      space_id: "personal-1", name: "Efectivo", account_type: "cash", institution: "Ueno", initial_balance: 500000, opening_debt: 0,
    }));
  });
});
