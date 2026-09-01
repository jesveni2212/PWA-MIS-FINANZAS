import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

afterEach(() => {
  cleanup();
  mockedCreateClient.mockReset();
});

describe("CreateGroupForm", () => {
  it("submits a trimmed group name to the protected RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "group-1", name: "Casa" }, error: null });
    mockedCreateClient.mockReturnValue({ rpc } as never);

    render(<CreateGroupForm />);
    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: "  Casa  " } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear grupo" }).closest("form")!);

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("create_shared_group", { group_name: "Casa" });
    });
    expect(await screen.findByText("Grupo creado: Casa.")).toBeInTheDocument();
  });

  it("notifies its parent after a successful creation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "group-1", name: "Casa" }, error: null });
    const onCreated = vi.fn();
    mockedCreateClient.mockReturnValue({ rpc } as never);

    render(<CreateGroupForm onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: "Casa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear grupo" }).closest("form")!);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it("does not call Supabase for blank names", () => {
    const rpc = vi.fn();
    mockedCreateClient.mockReturnValue({ rpc } as never);

    render(<CreateGroupForm />);
    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear grupo" }).closest("form")!);

    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByText("Ingresá un nombre para el grupo.")).toBeInTheDocument();
  });

  it("disables submission while the RPC is pending", () => {
    const rpc = vi.fn().mockReturnValue(new Promise(() => undefined));
    mockedCreateClient.mockReturnValue({ rpc } as never);

    render(<CreateGroupForm />);
    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: "Casa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear grupo" }).closest("form")!);

    expect(screen.getByRole("button", { name: "Creando…" })).toBeDisabled();
  });

  it("keeps the name and gives an actionable message when the RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "authentication required" } });
    mockedCreateClient.mockReturnValue({ rpc } as never);

    render(<CreateGroupForm />);
    const nameInput = screen.getByLabelText("Nombre del grupo");
    fireEvent.change(nameInput, { target: { value: "Casa" } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear grupo" }).closest("form")!);

    expect(await screen.findByText("No pudimos crear el grupo. Volvé a iniciar sesión e intentá de nuevo.")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Casa");
  });
});
