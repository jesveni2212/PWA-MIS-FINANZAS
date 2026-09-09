import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RegistrationConfirmationCard } from "@/components/auth/registration-confirmation-card";

afterEach(cleanup);

describe("RegistrationConfirmationCard", () => {
  it("shows the successful email-confirmation message without a greeting", () => {
    render(<RegistrationConfirmationCard status="success" />);

    expect(screen.getByRole("heading", { name: "Correo confirmado" })).toBeInTheDocument();
    expect(screen.getByText("Tu registro se completó correctamente. Tu cuenta ya está lista.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar a Mis Finanzas" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/Bienvenido|Hola,/)).not.toBeInTheDocument();
  });

  it("shows a non-sensitive error state with a login action", () => {
    render(<RegistrationConfirmationCard status="error" />);

    expect(screen.getByRole("heading", { name: "No pudimos confirmar tu correo" })).toBeInTheDocument();
    expect(screen.getByText("El enlace puede haber vencido o ya fue utilizado. Volvé a iniciar sesión para continuar.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a iniciar sesión" })).toHaveAttribute("href", "/acceso");
  });
});
