import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("exposes product navigation and its content", () => {
    render(
      <AppShell>
        <p>Contenido de prueba</p>
      </AppShell>,
    );

    expect(screen.getByText("Mis Finanzas")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Acceso" })).toHaveAttribute("href", "/acceso");
    expect(screen.getByRole("link", { name: "Registro" })).toHaveAttribute("href", "/registro");
    expect(screen.queryByRole("link", { name: "Inicio" })).not.toBeInTheDocument();
    expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
  });
});

