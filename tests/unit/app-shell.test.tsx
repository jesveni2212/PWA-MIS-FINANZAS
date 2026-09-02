import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";
import { MoneyValue } from "@/components/ui/money-value";

afterEach(cleanup);

describe("AppShell", () => {
  it("exposes the ledger navigation and its content", () => {
    render(
      <AppShell>
        <p>Contenido de prueba</p>
      </AppShell>,
    );

    expect(screen.getAllByText("Mis Finanzas")).not.toHaveLength(0);
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Cuentas" })).toHaveAttribute("href", "/cuentas");
    expect(screen.getByRole("link", { name: "Movimientos" })).toHaveAttribute("href", "/movimientos");
    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("href", "/grupos");
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
    expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
  });

  it("persists the balance visibility preference", () => {
    render(<AppShell><p>Contenido</p></AppShell>);

    const concealButton = screen.getByRole("button", { name: "Ocultar saldos" });
    expect(concealButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(concealButton);

    expect(screen.getByRole("button", { name: "Mostrar saldos" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("mis-finanzas:balances-hidden")).toBe("true");
  });
});

describe("MoneyValue", () => {
  it("masks an amount without exposing its value", () => {
    render(<MoneyValue amount={4680000} currency="PYG" hidden />);

    expect(screen.getByText("••••••")).toBeInTheDocument();
    expect(screen.getByLabelText("Saldo oculto")).toBeInTheDocument();
  });
});
