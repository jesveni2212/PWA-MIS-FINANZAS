import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { MoneyValue } from "@/components/ui/money-value";
import { createClient } from "@/lib/supabase/client";

const mockedUsePathname = vi.hoisted(() => vi.fn(() => "/"));

vi.mock("next/navigation", () => ({ usePathname: mockedUsePathname }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  mockedUsePathname.mockReturnValue("/");
  window.localStorage.removeItem("mis-finanzas:balances-hidden");
  document.body.style.overflow = "";
});
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

    expect(mobileGreeting).toHaveClass("min-w-0", "flex-1", "truncate", "text-left");
    expect(desktopGreeting).toHaveClass("min-w-0", "truncate");
    expect(mobileGreeting.textContent).toBe(expectedGreeting);
    expect(desktopGreeting.textContent).toBe(expectedGreeting);
    expect(within(mobileHeader).getByText("Mis Finanzas")).toHaveClass("shrink-0");
  });

  it("shows the greeting on its own row, not squeezed next to the menu and avatar", () => {
    render(<AppShell displayName="Alejandro Florentin"><p>Contenido</p></AppShell>);

    const header = screen.getByRole("banner");
    const greeting = within(header).getByText("Hola, Alejandro Florentin");

    expect(greeting.parentElement).not.toContainElement(within(header).getByRole("button", { name: "Abrir menú" }));
    expect(greeting.parentElement).not.toContainElement(within(header).getByRole("link", { name: "Abrir perfil" }));
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
    expect(screen.getByRole("link", { name: "Beneficios" })).toHaveAttribute("href", "/beneficios");
    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("href", "/grupos");
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
    expect(screen.getByText("Contenido de prueba")).toBeInTheDocument();
  });

  it("shows the sidebar only from the desktop breakpoint and keeps every section in it", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });

    expect(navigation).toHaveClass("hidden", "lg:block");
    expect(navigation).not.toHaveClass("mobile-bottom-nav");
    expect(within(navigation).getByRole("link", { name: "Perfil" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Recordatorios" })).toBeInTheDocument();
  });

  it("persists the balance visibility preference", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const sidebar = screen.getByRole("navigation", { name: "Navegación principal" });
    const concealButton = within(sidebar).getByRole("button", { name: "Ocultar saldos" });
    expect(concealButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(concealButton);

    expect(within(sidebar).getByRole("button", { name: "Mostrar saldos" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("mis-finanzas:balances-hidden")).toBe("true");
  });

  it("offers the balance toggle in the mobile header and shares the preference", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const header = screen.getByRole("banner");
    fireEvent.click(within(header).getByRole("button", { name: "Ocultar saldos" }));

    expect(within(header).getByRole("button", { name: "Mostrar saldos" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("mis-finanzas:balances-hidden")).toBe("true");
  });

  it("marks benefits active and keeps seven items in the responsive navigation", () => {
    mockedUsePathname.mockReturnValue("/beneficios");
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);
    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    const list = within(navigation).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
    const link = within(navigation).getByRole("link", { name: "Beneficios" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.querySelector("svg")).not.toBeNull();
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

describe("AppShell biometric lock", () => {
  it("shows the lock over the shell when a biometric enrollment exists and the session is locked", async () => {
    window.localStorage.setItem("mis-finanzas:biometric", JSON.stringify({ userId: "u1", credentialId: "abc" }));
    window.sessionStorage.clear();
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    expect(await screen.findByRole("dialog", { name: "Aplicación bloqueada" })).toBeInTheDocument();
    expect(mockedCreateClient).not.toHaveBeenCalled();
    window.localStorage.removeItem("mis-finanzas:biometric");
  });
});

describe("AppShell biometric lock ownership", () => {
  it("does not lock a session that is not the enrolled user's", async () => {
    window.localStorage.setItem("mis-finanzas:biometric", JSON.stringify({ userId: "u1", credentialId: "abc" }));
    window.sessionStorage.clear();
    render(<AppShell displayName={null} userId="u2"><p>Contenido</p></AppShell>);

    await waitFor(() => expect(window.localStorage.getItem("mis-finanzas:biometric")).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Aplicación bloqueada" })).not.toBeInTheDocument();
  });
});

describe("AppShell mobile menu", () => {
  function openMenu() {
    const trigger = screen.getByRole("button", { name: "Abrir menú" });
    fireEvent.click(trigger);
    return { trigger, dialog: screen.getByRole("dialog", { name: "Menú" }) };
  }

  it("shows a closed hamburger button in the header and no bottom bar", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const trigger = within(screen.getByRole("banner")).getByRole("button", { name: "Abrir menú" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
    expect(document.querySelector(".mobile-bottom-nav")).toBeNull();
  });

  it("opens a panel with every section and marks the current one", () => {
    mockedUsePathname.mockReturnValue("/beneficios");
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const { trigger, dialog } = openMenu();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const links = within(within(dialog).getByRole("navigation", { name: "Menú móvil" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Inicio", "Cuentas", "Movimientos", "Beneficios", "Grupos", "Recordatorios", "Perfil"]);
    expect(within(dialog).getByRole("link", { name: "Beneficios" })).toHaveAttribute("aria-current", "page");
    expect(within(dialog).getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });

  it("moves focus into the panel when it opens", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    const { dialog } = openMenu();

    expect(within(dialog).getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
  });

  it("closes with Escape and returns focus to the hamburger button", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);
    const { trigger } = openMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes with the close button and with a tap outside the panel", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);

    fireEvent.click(within(openMenu().dialog).getByRole("button", { name: "Cerrar menú" }));
    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByTestId("mobile-menu-backdrop"));
    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
  });

  it("closes after choosing a section", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);
    const { dialog } = openMenu();

    fireEvent.click(within(dialog).getByRole("link", { name: "Cuentas" }));

    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
  });

  it("keeps Tab focus inside the open panel", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);
    const { dialog } = openMenu();
    const close = within(dialog).getByRole("button", { name: "Cerrar menú" });
    const last = within(dialog).getByRole("link", { name: "Perfil" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("locks page scrolling while open and restores it on close", () => {
    render(<AppShell displayName={null}><p>Contenido</p></AppShell>);
    openMenu();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.body.style.overflow).toBe("");
  });
});
