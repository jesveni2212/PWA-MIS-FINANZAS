import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { MoneyValue } from "@/components/ui/money-value";
import { createClient } from "@/lib/supabase/client";

const mockedUsePathname = vi.hoisted(() => vi.fn(() => "/"));

vi.mock("next/navigation", () => ({ usePathname: mockedUsePathname }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => { mockedUsePathname.mockReturnValue("/"); });
afterEach(() => { cleanup(); mockedCreateClient.mockReset(); });

describe("AppShell greeting", () => {
  it("renders the server-provided profile name without invoking the browser client", () => {
    render(<AppShell displayName="Ana"><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const desktopSidebar = screen.getByRole("navigation", { name: "Navegación principal" });

    expect(within(mobileHeader).getByText("Hola, Ana")).toBeInTheDocument();
    expect(within(desktopSidebar).getByText("Hola, Ana")).toBeInTheDocument();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("keeps long greetings in shrinkable single-line containers", () => {
    const longName = "A".repeat(80);
    const expectedGreeting = `Hola, ${longName}`;
    render(<AppShell displayName={longName}><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const desktopSidebar = screen.getByRole("navigation", { name: "Navegación principal" });
    const mobileGreeting = within(mobileHeader).getByText(expectedGreeting);
    const desktopGreeting = within(desktopSidebar).getByText(expectedGreeting);

    expect(mobileGreeting).toHaveClass("min-w-0", "flex-1", "truncate", "text-right");
    expect(desktopGreeting).toHaveClass("min-w-0", "truncate");
    expect(mobileGreeting.textContent).toBe(expectedGreeting);
    expect(desktopGreeting.textContent).toBe(expectedGreeting);
    expect(within(mobileHeader).getByText("Mis Finanzas")).toHaveClass("shrink-0");
  });

  it("keeps the generic greeting when no display name is provided", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const desktopSidebar = screen.getByRole("navigation", { name: "Navegación principal" });

    expect(within(mobileHeader).getByText("Bienvenido/a")).toBeInTheDocument();
    expect(within(desktopSidebar).getByText("Bienvenido/a")).toBeInTheDocument();
    expect(within(mobileHeader).queryByText(/Hola,/)).not.toBeInTheDocument();
    expect(within(desktopSidebar).queryByText(/Hola,/)).not.toBeInTheDocument();
  });

  it("exposes Profile from the mobile header with initials", () => {
    render(<AppShell displayName="Ana Pérez"><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const profileLink = within(mobileHeader).getByRole("link", { name: "Abrir perfil" });

    expect(profileLink).toHaveAttribute("href", "/perfil");
    expect(within(profileLink).getByRole("img", { name: "Foto de perfil" })).toHaveTextContent("AP");
  });
});

describe("AppShell", () => {
  it("shows compact offline status when the personal store is unavailable", () => {
    render(
      <PersonalFinanceProvider initialLedger={{ accounts: [], transactions: [] }} initialLedgerUpdatedAt={null} userId="shell-status">
        <AppShell displayName={null}><p>Contenido</p></AppShell>
      </PersonalFinanceProvider>,
    );

    expect(screen.getAllByText("Sin conexión")).not.toHaveLength(0);
  });

  it("exposes the ledger navigation and its content", () => {
    render(
      <AppShell displayName={null}>
        <p>Contenido de prueba</p>
      </AppShell>,
    );

    expect(screen.getAllByText("Mis Finanzas")).not.toHaveLength(0);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Cuentas" })).toHaveAttribute("href", "/cuentas");
    expect(screen.getByRole("link", { name: "Movimientos" })).toHaveAttribute("href", "/movimientos");
    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("href", "/grupos");
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
    expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
  });

  it("keeps Profile out of the mobile dock while preserving it in the desktop sidebar", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    const profileLink = within(navigation).getByRole("link", { name: "Perfil" });

    expect(navigation).toHaveClass("mobile-bottom-nav", "rounded-2xl");
    expect(profileLink.closest("li")).toHaveClass("hidden", "lg:block");
    expect(within(navigation).getByRole("link", { name: "Recordatorios" })).toHaveClass("min-h-14");
  });

  it("persists the balance visibility preference", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const concealButton = screen.getByRole("button", { name: "Ocultar saldos" });
    expect(concealButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(concealButton);

    expect(screen.getByRole("button", { name: "Mostrar saldos" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("mis-finanzas:balances-hidden")).toBe("true");
  });

  it("marks the current main route in the navigation", () => {
    mockedUsePathname.mockReturnValue("/movimientos");
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const currentLink = screen.getByRole("link", { name: "Movimientos" });
    expect(currentLink).toHaveAttribute("aria-current", "page");
    expect(currentLink).toHaveClass("border-signal/40", "bg-brand-soft", "text-signal");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });

  it("marks the header Profile avatar when the profile route is active", () => {
    mockedUsePathname.mockReturnValue("/perfil");
    render(<AppShell displayName="Ana"><p>Contenido</p></AppShell>);

    const profileLink = within(screen.getByRole("banner")).getByRole("link", { name: "Abrir perfil" });

    expect(profileLink).toHaveAttribute("aria-current", "page");
    expect(profileLink).toHaveClass("border-signal", "bg-brand-soft");
  });
});

describe("MoneyValue", () => {
  it("masks an amount without exposing its value", () => {
    render(<MoneyValue amount={4680000} currency="PYG" hidden />);

    expect(screen.getByText("••••••")).toBeInTheDocument();
    expect(screen.getByLabelText("Saldo oculto")).toBeInTheDocument();
  });
});
