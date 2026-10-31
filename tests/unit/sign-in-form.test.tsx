import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignInForm } from "@/components/auth/sign-in-form";

const signInWithPassword = vi.hoisted(() => vi.fn());
const assign = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithPassword } }) }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));

const emailKey = "mis-finanzas:remembered-email";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  signInWithPassword.mockReset();
  assign.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
});
afterEach(cleanup);

async function submit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("SignInForm remember email", () => {
  it("prefills the stored email and checks the remember box", async () => {
    window.localStorage.setItem(emailKey, "ana@example.com");
    render(<SignInForm />);

    await waitFor(() => expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@example.com"));
    expect(screen.getByLabelText("Recordar mi correo")).toBeChecked();
  });

  it("leaves the box unchecked when nothing is stored", () => {
    render(<SignInForm />);
    expect(screen.getByLabelText("Recordar mi correo")).not.toBeChecked();
  });

  it("stores the trimmed email after a successful sign-in with the box checked", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    render(<SignInForm next="/perfil" />);

    fireEvent.click(screen.getByLabelText("Recordar mi correo"));
    await submit(" ana@example.com ", "segura123");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/perfil"));
    expect(window.localStorage.getItem(emailKey)).toBe("ana@example.com");
  });

  it("forgets the email after a successful sign-in with the box unchecked", async () => {
    window.localStorage.setItem(emailKey, "ana@example.com");
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    render(<SignInForm />);

    await waitFor(() => expect(screen.getByLabelText("Recordar mi correo")).toBeChecked());
    fireEvent.click(screen.getByLabelText("Recordar mi correo"));
    await submit("ana@example.com", "segura123");

    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(window.localStorage.getItem(emailKey)).toBeNull();
  });

  it("does not store the email when the sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error("bad") });
    render(<SignInForm />);

    fireEvent.click(screen.getByLabelText("Recordar mi correo"));
    await submit("ana@example.com", "mala");

    await screen.findByText("No pudimos iniciar sesión. Revisá tu correo y contraseña.");
    expect(window.localStorage.getItem(emailKey)).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("never persists the password in any storage", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    render(<SignInForm />);

    fireEvent.click(screen.getByLabelText("Recordar mi correo"));
    await submit("ana@example.com", "secreta-unica-987");
    await waitFor(() => expect(assign).toHaveBeenCalled());

    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const stored = storage.getItem(storage.key(index)!) ?? "";
        expect(stored).not.toContain("secreta-unica-987");
      }
    }
  });
});
