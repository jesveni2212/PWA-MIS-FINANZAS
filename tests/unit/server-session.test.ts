import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getUser, from, select, eq, maybeSingle } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

describe("getServerSessionData", () => {
  beforeEach(() => {
    createClient.mockReset();
    getUser.mockReset();
    from.mockReset();
    select.mockReset();
    eq.mockReset();
    maybeSingle.mockReset();
    createClient.mockResolvedValue({ auth: { getUser }, from });
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
    vi.resetModules();
  });

  it("returns null when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { getServerSessionData } = await import("@/lib/auth/server-session");

    await expect(getServerSessionData()).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the authenticated user ID and profile identity data", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { display_name: "Ana", avatar_path: "user-1/avatar.webp" }, error: null });

    const { getServerSessionData } = await import("@/lib/auth/server-session");

    await expect(getServerSessionData()).resolves.toEqual({ userId: "user-1", displayName: "Ana", avatarPath: "user-1/avatar.webp" });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("display_name,avatar_path");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });
});
