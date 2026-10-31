const rememberedEmailKey = "mis-finanzas:remembered-email";

// Only the email is ever stored, never the password. Storage failures are non-fatal.
export function getRememberedEmail(): string {
  try {
    return window.localStorage.getItem(rememberedEmailKey) ?? "";
  } catch {
    return "";
  }
}

export function forgetEmail(): void {
  try {
    window.localStorage.removeItem(rememberedEmailKey);
  } catch {
    // Nothing to forget if storage is unavailable.
  }
}

export function rememberEmail(email: string): void {
  const normalized = email.trim();
  if (!normalized) { forgetEmail(); return; }
  try {
    window.localStorage.setItem(rememberedEmailKey, normalized);
  } catch {
    // Remembering is a convenience; sign-in must not fail because of it.
  }
}
