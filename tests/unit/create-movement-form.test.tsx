import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateMovementForm } from "@/components/movements/create-movement-form";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const spaces = [{ id: "space-1", name: "Mis finanzas", kind: "personal" as const }];

afterEach(() => { cleanup(); mockedCreateClient.mockReset(); });

describe("CreateMovementForm", () => {
  it("stores a movement for the authenticated user", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: vi.fn().mockReturnValue({ insert }),
    } as never);

    render(<CreateMovementForm spaces={spaces} />);
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "12500.50" } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "  Supermercado " } });
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "  Compra semanal " } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar movimiento" }).closest("form")!);

    await waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      space_id: "space-1", created_by: "user-1", kind: "expense", amount: 12500.5, category: "Supermercado", note: "Compra semanal",
    })));
    expect(await screen.findByText("Movimiento guardado.")).toBeInTheDocument();
  });

  it("does not submit invalid amounts", () => {
    const insert = vi.fn();
    mockedCreateClient.mockReturnValue({ auth: { getUser: vi.fn() }, from: vi.fn().mockReturnValue({ insert }) } as never);

    render(<CreateMovementForm spaces={spaces} />);
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "Comida" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar movimiento" }).closest("form")!);

    expect(insert).not.toHaveBeenCalled();
    expect(screen.getByText("Completá el espacio, importe y categoría con valores válidos.")).toBeInTheDocument();
  });
});
