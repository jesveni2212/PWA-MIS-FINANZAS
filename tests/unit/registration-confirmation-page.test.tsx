import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RegistrationConfirmationPage from "@/app/registro-confirmado/page";

afterEach(cleanup);

describe("RegistrationConfirmationPage", () => {
  it("maps the exact successful estado to the success card", async () => {
    const page = await RegistrationConfirmationPage({
      searchParams: Promise.resolve({ estado: "exitoso" }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "Correo confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar a Mis Finanzas" })).toHaveAttribute("href", "/");
  });

  it.each([
    ["error", "error"],
    ["missing", undefined],
    ["other value", "confirmado"],
    ["repeated values", ["exitoso", "error"]],
  ])("maps %s to the controlled error card", async (_caseName, estado) => {
    const page = await RegistrationConfirmationPage({
      searchParams: Promise.resolve({ estado }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "No pudimos confirmar tu correo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a iniciar sesión" })).toHaveAttribute("href", "/acceso");
  });
});
