import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetEmail, getRememberedEmail, rememberEmail } from "@/lib/auth/remembered-email";

const key = "mis-finanzas:remembered-email";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("remembered email", () => {
  it("stores the trimmed email", () => {
    rememberEmail("  ana@example.com ");
    expect(window.localStorage.getItem(key)).toBe("ana@example.com");
    expect(getRememberedEmail()).toBe("ana@example.com");
  });

  it("forgets the email when asked to remember an empty one", () => {
    rememberEmail("ana@example.com");
    rememberEmail("   ");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("forgetEmail removes the stored value", () => {
    rememberEmail("ana@example.com");
    forgetEmail();
    expect(getRememberedEmail()).toBe("");
  });

  it("returns an empty string and never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });

    expect(getRememberedEmail()).toBe("");
    expect(() => rememberEmail("ana@example.com")).not.toThrow();
    expect(() => forgetEmail()).not.toThrow();
  });
});
