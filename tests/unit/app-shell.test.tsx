import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { MoneyValue } from "@/components/ui/money-value";
import { createClient } from "@/lib/supabase/client";

const mockedUsePathname = vi.hoisted(() => vi.fn(() => "/"));

vi.mock("next/navigation", () => ({ usePathname: mockedUsePathname }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

function mockProfile(displayName: string | null, profileError: object | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: displayName }, error: profileError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  mockedCreateClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    from,
  } as never);

  return { eq, from, maybeSingle, select };
}

beforeEach(() => { mockedUsePathname.mockReturnValue("/"); mockProfile("Ana"); });
afterEach(() => { cleanup(); mockedCreateClient.mockReset(); });

describe("AppShell greeting", () => {
  it("renders the profile name in the compact greeting", async () => {
    const { eq, from, select } = mockProfile("Ana");
    render(<AppShell><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const desktopSidebar = screen.getByRole("navigation", { name: "Navegación principal" });

    await waitFor(() => {
      expect(within(mobileHeader).getByText("Hola, Ana")).toBeInTheDocument();
      expect(within(desktopSidebar).getByText("Hola, Ana")).toBeInTheDocument();
    });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("display_name");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("keeps long greetings in shrinkable single-line containers", async () => {
    const longName = "A".repeat(80);
    const expectedGreeting = `Hola, ${longName}`;
    mockProfile(longName);
    render(<AppShell><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const desktopSidebar = screen.getByRole("navigation", { name: "Navegación principal" });

    await waitFor(() => {
      const mobileGreeting = within(mobileHeader).getByText(expectedGreeting);
      const desktopGreeting = within(desktopSidebar).getByText(expectedGreeting);

      expect(mobileGreeting).toHaveClass("min-w-0", "flex-1", "truncate", "text-right");
      expect(desktopGreeting).toHaveClass("min-w-0", "truncate");
      expect(mobileGreeting.textContent).toBe(expectedGreeting);
      expect(desktopGreeting.textContent).toBe(expectedGreeting);
    });

    expect(within(mobileHeader).getByText("Mis Finanzas")).toHaveClass("shrink-0");
  });

  it("keeps the generic greeting when the profile query fails", async () => {
    mockProfile("Ana", { message: "profile unavailable" });
    render(<AppShell><p>Contenido</p></AppShell>);

    const mobileHeader = screen.getByRole("banner");
    const desktopSidebar = screen.getByRole("navigation", { name: "Navegación principal" });

    await waitFor(() => {
      expect(within(mobileHeader).getByText("Bienvenido/a")).toBeInTheDocument();
      expect(within(desktopSidebar).getByText("Bienvenido/a")).toBeInTheDocument();
    });
    expect(within(mobileHeader).queryByText(/Hola,/)).not.toBeInTheDocument();
    expect(within(desktopSidebar).queryByText(/Hola,/)).not.toBeInTheDocument();
  });
});

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

  it("marks the current main route in the navigation", () => {
    mockedUsePathname.mockReturnValue("/movimientos");
    render(<AppShell><p>Contenido</p></AppShell>);

    const currentLink = screen.getByRole("link", { name: "Movimientos" });
    expect(currentLink).toHaveAttribute("aria-current", "page");
    expect(currentLink).toHaveClass("border-signal/40", "bg-brand-soft", "text-signal");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });
});

describe("MoneyValue", () => {
  it("masks an amount without exposing its value", () => {
    render(<MoneyValue amount={4680000} currency="PYG" hidden />);

    expect(screen.getByText("••••••")).toBeInTheDocument();
    expect(screen.getByLabelText("Saldo oculto")).toBeInTheDocument();
  });
});
