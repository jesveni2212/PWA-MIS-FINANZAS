import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSessionData, loadPersonalLedgerServer, loadRemindersServer, redirect } = vi.hoisted(() => ({
  getServerSessionData: vi.fn(),
  loadPersonalLedgerServer: vi.fn(),
  loadRemindersServer: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth/server-session", () => ({ getServerSessionData }));
vi.mock("@/lib/finance/personal-ledger-server", () => ({ loadPersonalLedgerServer }));
vi.mock("@/lib/reminders/server", () => ({ loadRemindersServer }));
vi.mock("next/navigation", () => ({ redirect }));

describe("HomePage", () => {
  beforeEach(() => {
    getServerSessionData.mockReset();
    loadPersonalLedgerServer.mockReset();
    loadRemindersServer.mockReset();
    loadRemindersServer.mockResolvedValue([]);
    redirect.mockClear();
    vi.resetModules();
  });

  it("redirects visitors without a session to /acceso", async () => {
    getServerSessionData.mockResolvedValue(null);

    const { default: HomePage } = await import("@/app/page");

    await expect((async () => HomePage())()).rejects.toThrow("REDIRECT:/acceso");
    expect(redirect).toHaveBeenCalledWith("/acceso");
  });

  it("renders the provider composition for authenticated users", async () => {
    const initialLedger = { accounts: [], transactions: [] };
    getServerSessionData.mockResolvedValue({ userId: "user-1", displayName: "Ana" });
    loadPersonalLedgerServer.mockResolvedValue(initialLedger);

    const { default: HomePage } = await import("@/app/page");
    const element = await (async () => HomePage())();

    expect(redirect).not.toHaveBeenCalled();
    expect(element.props.userId).toBe("user-1");
    expect(element.props.initialLedger).toBe(initialLedger);
    expect(typeof element.props.initialLedgerUpdatedAt).toBe("string");
    expect(loadPersonalLedgerServer).toHaveBeenCalledWith(50);
    expect(loadRemindersServer).toHaveBeenCalledTimes(1);
  });
});
