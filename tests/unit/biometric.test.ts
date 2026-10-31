import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearBiometric,
  enrollBiometric,
  getEnrollment,
  isBiometricSupported,
  isUnlocked,
  markHidden,
  markLocked,
  markUnlocked,
  relockAfterMs,
  shouldRelock,
  unlockWithBiometric,
} from "@/lib/auth/biometric";

const rawId = new Uint8Array([251, 255, 190]).buffer; // base64url: -_-- (no padding)
const create = vi.fn();
const get = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  create.mockReset();
  get.mockReset();
  vi.stubGlobal("navigator", { ...navigator, credentials: { create, get } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubPublicKeyCredential(available: boolean) {
  vi.stubGlobal("PublicKeyCredential", {
    isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(available),
  });
}

describe("isBiometricSupported", () => {
  it("is false without PublicKeyCredential", async () => {
    vi.stubGlobal("PublicKeyCredential", undefined);
    await expect(isBiometricSupported()).resolves.toBe(false);
  });

  it("is true when a platform authenticator is available", async () => {
    stubPublicKeyCredential(true);
    await expect(isBiometricSupported()).resolves.toBe(true);
  });

  it("is false when no platform authenticator is available", async () => {
    stubPublicKeyCredential(false);
    await expect(isBiometricSupported()).resolves.toBe(false);
  });
});

describe("enrollBiometric", () => {
  it("creates a platform credential requiring user verification and stores the enrollment", async () => {
    create.mockResolvedValue({ rawId });

    await expect(enrollBiometric("u1")).resolves.toBe(true);

    const options = create.mock.calls[0][0].publicKey;
    expect(options.authenticatorSelection).toEqual({
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "discouraged",
    });
    expect(options.rp.id).toBe(window.location.hostname);
    expect(JSON.parse(window.localStorage.getItem("mis-finanzas:biometric")!)).toEqual({
      userId: "u1",
      credentialId: "-_--",
    });
  });

  it("stores nothing when the user cancels", async () => {
    create.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));

    await expect(enrollBiometric("u1")).resolves.toBe(false);
    expect(window.localStorage.getItem("mis-finanzas:biometric")).toBeNull();
  });

  it("stores nothing when no credential is returned", async () => {
    create.mockResolvedValue(null);

    await expect(enrollBiometric("u1")).resolves.toBe(false);
    expect(window.localStorage.getItem("mis-finanzas:biometric")).toBeNull();
  });

  it("returns false when storage is unavailable", async () => {
    create.mockResolvedValue({ rawId });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });

    await expect(enrollBiometric("u1")).resolves.toBe(false);
  });
});

describe("unlockWithBiometric", () => {
  it("asks for user verification against the enrolled credential", async () => {
    create.mockResolvedValue({ rawId });
    await enrollBiometric("u1");
    get.mockResolvedValue({ rawId });

    await expect(unlockWithBiometric()).resolves.toBe(true);

    const options = get.mock.calls[0][0].publicKey;
    expect(options.userVerification).toBe("required");
    expect(new Uint8Array(options.allowCredentials[0].id as ArrayBuffer)).toEqual(new Uint8Array([251, 255, 190]));
  });

  it("returns false when the prompt throws or returns nothing", async () => {
    create.mockResolvedValue({ rawId });
    await enrollBiometric("u1");

    get.mockRejectedValueOnce(new DOMException("cancelled", "NotAllowedError"));
    await expect(unlockWithBiometric()).resolves.toBe(false);
    get.mockResolvedValueOnce(null);
    await expect(unlockWithBiometric()).resolves.toBe(false);
  });

  it("returns false without prompting when nothing is enrolled", async () => {
    await expect(unlockWithBiometric()).resolves.toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("getEnrollment", () => {
  it("treats corrupted JSON as not enrolled", () => {
    window.localStorage.setItem("mis-finanzas:biometric", "{no");
    expect(getEnrollment()).toBeNull();
  });

  it("treats an object without credentialId as not enrolled", () => {
    window.localStorage.setItem("mis-finanzas:biometric", JSON.stringify({ userId: "u1" }));
    expect(getEnrollment()).toBeNull();
  });

  it("is null and clearBiometric does not throw when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });

    expect(getEnrollment()).toBeNull();
    expect(() => clearBiometric()).not.toThrow();
  });
});

describe("unlock state", () => {
  it("clearBiometric removes the enrollment and the unlocked mark", () => {
    window.localStorage.setItem("mis-finanzas:biometric", JSON.stringify({ userId: "u1", credentialId: "abc" }));
    markUnlocked();
    expect(isUnlocked()).toBe(true);

    clearBiometric();

    expect(getEnrollment()).toBeNull();
    expect(isUnlocked()).toBe(false);
  });

  it("markLocked drops the unlocked mark but keeps the enrollment", () => {
    window.localStorage.setItem("mis-finanzas:biometric", JSON.stringify({ userId: "u1", credentialId: "abc" }));
    markUnlocked();

    markLocked();

    expect(isUnlocked()).toBe(false);
    expect(getEnrollment()).not.toBeNull();
  });

  it("markUnlocked clears a stale hidden-at so a later reload does not relock", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    markHidden();

    markUnlocked();

    expect(window.sessionStorage.getItem("mis-finanzas:hidden-at")).toBeNull();
    expect(shouldRelock(1_000_000 + relockAfterMs * 10)).toBe(false);
  });

  it("relocks only after the background threshold", () => {
    expect(shouldRelock(1_000_000)).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    markHidden();
    expect(window.sessionStorage.getItem("mis-finanzas:hidden-at")).toBe("1000000");
    expect(shouldRelock(1_000_000 + relockAfterMs - 1)).toBe(false);
    expect(shouldRelock(1_000_000 + relockAfterMs)).toBe(true);
  });
});
