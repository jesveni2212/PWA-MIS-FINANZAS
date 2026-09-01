import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/profile/profile-form";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
const mockedCreateClient = vi.mocked(createClient);

function mockClient({ user = { id: "user-1", email: "ana@example.com" }, profile = { display_name: "Ana" } }: { user?: { id: string; email: string } | null; profile?: { display_name: string | null } | null } = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  mockedCreateClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })), update })),
  } as never);
  return { update, updateEq };
}

afterEach(() => { cleanup(); mockedCreateClient.mockReset(); });

describe("ProfileForm", () => {
  it("loads the authenticated email and display name", async () => {
    mockClient();
    render(<ProfileForm />);
    expect(await screen.findByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("does not submit an empty display name", async () => {
    const { update } = mockClient();
    render(<ProfileForm />);
    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Ingresá un nombre para tu perfil.")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("saves a trimmed display name for the authenticated profile", async () => {
    const { update, updateEq } = mockClient();
    render(<ProfileForm />);
    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "  Ana P.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ display_name: "Ana P." }));
    expect(updateEq).toHaveBeenCalledWith("id", "user-1");
    expect(await screen.findByText("Perfil actualizado.")).toBeInTheDocument();
  });

  it("reports when the session is unavailable", async () => {
    mockClient({ user: null });
    render(<ProfileForm />);
    expect(await screen.findByText("Tu sesión no está disponible. Volvé a iniciar sesión.")).toBeInTheDocument();
  });
});
