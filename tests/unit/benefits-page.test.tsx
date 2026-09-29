import { beforeEach, describe, expect, it, vi } from "vitest";

import BeneficiosPage from "@/app/beneficios/page";
import { AppShell } from "@/components/app-shell";
import { PersonalBenefitsProvider } from "@/components/benefits/personal-benefits-provider";
import { personalBenefitsLoadError } from "@/lib/benefits/benefit-payload";

const { session, ledger, benefits, redirect } = vi.hoisted(() => ({
  session: vi.fn(), ledger: vi.fn(), benefits: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("@/lib/auth/server-session", () => ({ getServerSessionData: session }));
vi.mock("@/lib/finance/personal-ledger-server", () => ({ loadPersonalLedgerServer: ledger }));
vi.mock("@/lib/benefits/server", () => ({ loadPersonalBenefitsServer: benefits }));
vi.mock("next/navigation", () => ({ redirect }));

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ userId: "user-1", displayName: "Ana", avatarPath: null });
  ledger.mockResolvedValue({ accounts: [], transactions: [] }); benefits.mockResolvedValue([]);
});

describe("BeneficiosPage", () => {
  it("redirects unauthenticated users before loading finance or benefits", async () => {
    session.mockResolvedValue(null);
    await expect(BeneficiosPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/acceso");
    expect(ledger).not.toHaveBeenCalled(); expect(benefits).not.toHaveBeenCalled();
  });

  it("loads the selected period and composes finance, shell and benefits providers", async () => {
    const page = await BeneficiosPage({ searchParams: Promise.resolve({ periodo: "2026-08" }) });
    expect(page.props.userId).toBe("user-1");
    expect(typeof page.props.initialLedgerUpdatedAt).toBe("string");
    expect(page.props.children.type).toBe(AppShell);
    const provider = page.props.children.props.children;
    expect(provider.type).toBe(PersonalBenefitsProvider);
    expect(provider.props.periodStart).toBe("2026-08-01");
    expect(provider.props.initialError).toBeNull();
    expect(provider.props.children.props.periodStart).toBe("2026-08-01");
    expect(ledger).toHaveBeenCalledWith(50);
    expect(benefits).toHaveBeenCalledWith("2026-08-01");
  });

  it("keeps an empty ledger and a distinct benefit error when server loads fail", async () => {
    ledger.mockRejectedValue(new Error("finance unavailable")); benefits.mockRejectedValue(new Error("benefits unavailable"));
    const page = await BeneficiosPage({ searchParams: Promise.resolve({ periodo: "2026-09" }) });
    expect(page.props.initialLedger).toEqual({ accounts: [], transactions: [] });
    expect(page.props.initialLedgerUpdatedAt).toBeNull();
    const provider = page.props.children.props.children;
    expect(provider.props.initialBenefits).toBeNull();
    expect(provider.props.initialError).toBe(personalBenefitsLoadError);
  });

  it("keeps the benefit snapshot usable when only finance fails", async () => {
    ledger.mockRejectedValue(new Error("finance unavailable"));
    const page = await BeneficiosPage({ searchParams: Promise.resolve({ periodo: "2026-09" }) });
    expect(page.props.initialLedgerUpdatedAt).toBeNull();
    expect(page.props.children.props.children.props.initialBenefits).toEqual([]);
    expect(page.props.children.props.children.props.initialError).toBeNull();
  });

  it.each(["2026-13", "0000-09", "malformed", ["2026-09", "2026-10"], undefined])("falls back to the current month for invalid period %s", async (periodo) => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    await BeneficiosPage({ searchParams: Promise.resolve({ periodo }) });
    expect(benefits).toHaveBeenCalledWith(expected);
  });
});
