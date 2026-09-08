import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, exchangeCodeForSession } = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

describe("authentication callback", () => {
  beforeEach(() => {
    createClient.mockReset();
    exchangeCodeForSession.mockReset();
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession } });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  it("exchanges a PKCE code and redirects to a safe internal path", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?code=pkce-code&next=%2Fperfil"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(response.headers.get("location")).toBe("https://app.test/perfil");
  });

  it("does not exchange a missing code or redirect an external next value", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?next=https%3A%2F%2Fevil.test"));

    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/");
  });

  it("keeps auth paths and failed exchanges on a safe redirect", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new NextRequest("https://app.test/auth/callback?code=invalid&next=%2Facceso"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("invalid");
    expect(response.headers.get("location")).toBe("https://app.test/");
  });
});
