export type BiometricEnrollment = { userId: string; credentialId: string };

export const relockAfterMs = 5 * 60 * 1000;

const enrollmentKey = "mis-finanzas:biometric";
const unlockedKey = "mis-finanzas:unlocked";
const hiddenAtKey = "mis-finanzas:hidden-at";

type StorageKind = "local" | "session";

// Storage can be blocked (private mode, quota); that must never break sign-in or the shell.
function withStorage<T>(kind: StorageKind, fallback: T, op: (storage: Storage) => T): T {
  try {
    return op(kind === "local" ? window.localStorage : window.sessionStorage);
  } catch {
    return fallback;
  }
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return bytes.buffer;
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof PublicKeyCredential === "undefined" || !PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getEnrollment(): BiometricEnrollment | null {
  const raw = withStorage<string | null>("local", null, (storage) => storage.getItem(enrollmentKey));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value && typeof value === "object" &&
      typeof (value as BiometricEnrollment).userId === "string" &&
      typeof (value as BiometricEnrollment).credentialId === "string"
    ) {
      return { userId: (value as BiometricEnrollment).userId, credentialId: (value as BiometricEnrollment).credentialId };
    }
  } catch {
    // Corrupted value: treat as not enrolled.
  }
  return null;
}

export async function enrollBiometric(userId: string): Promise<boolean> {
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { id: window.location.hostname, name: "Mis Finanzas" },
        user: { id: new TextEncoder().encode(userId), name: userId, displayName: userId },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;
    if (!credential) return false;
    const enrollment: BiometricEnrollment = { userId, credentialId: toBase64Url(credential.rawId) };
    return withStorage("local", false, (storage) => {
      storage.setItem(enrollmentKey, JSON.stringify(enrollment));
      return true;
    });
  } catch {
    return false;
  }
}

export async function unlockWithBiometric(): Promise<boolean> {
  const enrollment = getEnrollment();
  if (!enrollment) return false;
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        rpId: window.location.hostname,
        allowCredentials: [{ type: "public-key", id: fromBase64Url(enrollment.credentialId) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return credential !== null;
  } catch {
    return false;
  }
}

export function clearBiometric(): void {
  withStorage("local", undefined, (storage) => storage.removeItem(enrollmentKey));
  withStorage("session", undefined, (storage) => storage.removeItem(unlockedKey));
}

export function markUnlocked(): void {
  withStorage("session", undefined, (storage) => storage.setItem(unlockedKey, "1"));
}

export function isUnlocked(): boolean {
  return withStorage("session", false, (storage) => storage.getItem(unlockedKey) === "1");
}

export function markHidden(): void {
  withStorage("session", undefined, (storage) => storage.setItem(hiddenAtKey, String(Date.now())));
}

export function shouldRelock(now: number = Date.now()): boolean {
  const raw = withStorage<string | null>("session", null, (storage) => storage.getItem(hiddenAtKey));
  if (!raw) return false;
  const hiddenAt = Number(raw);
  return Number.isFinite(hiddenAt) && now - hiddenAt >= relockAfterMs;
}
