import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.fn();
const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient,
  createServerClient,
}));

describe("Supabase SSR clients", () => {
  beforeEach(() => {
    createBrowserClient.mockReset();
    createServerClient.mockReset();
    vi.resetModules();
  });

  it("creates the browser client with exactly the two public environment variables", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://finanzas.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    const { createClient } = await import("@/lib/supabase/client");
    createClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://finanzas.supabase.co",
      "publishable-key",
    );
  });

  it("refreshes the session and returns an anonymous user", async () => {
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: "sb-access-token", value: "fresh-token" }]);
      return {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      };
    });

    const { updateSession } = await import("@/lib/supabase/proxy");
    const { response, user } = await updateSession(
      new NextRequest("https://app.test/perfil"),
    );

    expect(user).toBeNull();
    expect(response.cookies.get("sb-access-token")?.value).toBe("fresh-token");
  });

  it("redirects an anonymous private request after refreshing its session", async () => {
    const refreshedResponse = NextResponse.next();
    refreshedResponse.cookies.set("sb-access-token", "fresh-token");

    vi.doMock("@/lib/supabase/proxy", () => ({
      updateSession: vi.fn().mockResolvedValue({
        response: refreshedResponse,
        user: null,
      }),
    }));

    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("https://app.test/perfil"));

    expect(response.headers.get("location")).toBe(
      "https://app.test/acceso?next=%2Fperfil",
    );
    expect(response.cookies.get("sb-access-token")?.value).toBe("fresh-token");
  });
});