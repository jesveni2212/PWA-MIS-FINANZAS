import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { createClient } from "@/lib/supabase/client";

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  mockedCreateClient.mockReturnValue({ auth: { signUp } } as never);
});

afterEach(() => {
  cleanup();
  mockedCreateClient.mockReset();
});

describe("SignUpForm with Supabase configured", () => {
  it("sends the confirmation callback as emailRedirectTo", async () => {
    render(<SignUpForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "segura123" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "segura123",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fregistro-confirmado" },
    }));
    expect(await screen.findByText("Cuenta creada. Revisá tu correo si se solicita confirmación.")).toBeInTheDocument();
  });
});
