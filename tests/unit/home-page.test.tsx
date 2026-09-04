import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getUser, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));

describe("HomePage", () => {
  beforeEach(() => {
    createClient.mockReset();
    getUser.mockReset();
    redirect.mockClear();
    createClient.mockResolvedValue({ auth: { getUser } });
    vi.resetModules();
  });

  it("redirects visitors without a session to /acceso", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const { default: HomePage } = await import("@/app/page");

    await expect((async () => HomePage())()).rejects.toThrow("REDIRECT:/acceso");
    expect(redirect).toHaveBeenCalledWith("/acceso");
  });

  it("renders an element for authenticated users", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const { default: HomePage } = await import("@/app/page");
    const element = await (async () => HomePage())();

    expect(redirect).not.toHaveBeenCalled();
    expect(isValidElement(element)).toBe(true);
  });
});
