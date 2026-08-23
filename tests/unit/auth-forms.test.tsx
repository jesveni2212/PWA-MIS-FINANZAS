import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

afterEach(cleanup);

describe("authentication forms without Supabase", () => {
  it("shows an accessible sign-in form and configuration notice", () => {
    render(<SignInForm next="/perfil" />);

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "segura123" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(screen.getByText("La autenticación estará disponible cuando se configure el servicio.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recuperar contraseña" })).toHaveAttribute("href", "/recuperar-contrasena");
  });

  it("offers registration and recovery without creating a simulated account", () => {
    const signUp = render(<SignUpForm />);
    fireEvent.change(signUp.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.change(signUp.getByLabelText("Contraseña"), { target: { value: "segura123" } });
    fireEvent.click(signUp.getByRole("button", { name: "Crear mi cuenta" }));
    expect(signUp.getByText("La autenticación estará disponible cuando se configure el servicio.")).toBeInTheDocument();

    cleanup();
    const recovery = render(<PasswordRecoveryForm />);
    fireEvent.change(recovery.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.click(recovery.getByRole("button", { name: "Enviar instrucciones" }));
    expect(screen.getByText("La autenticación estará disponible cuando se configure el servicio.")).toBeInTheDocument();
  });
});
