export const registrationConfirmationPath = "/registro-confirmado" as const;

export const privatePaths = [
  "/",
  "/cuentas",
  "/movimientos",
  "/grupos",
  "/recordatorios",
  "/perfil",
] as const;

export const authPaths = [
  "/acceso",
  "/registro",
  "/recuperar-contrasena",
] as const;

const defaultReturnPath = "/";
const passwordRecoveryReturnPath = "/recuperar-contrasena?modo=restablecer";
const safeReturnOrigin = "https://safe-return.invalid";
const asciiControlCharacters = /[\u0000-\u001F\u007F]/;

function normalizePathname(value: string): string {
  return value.split("?")[0]?.split("#")[0] ?? value;
}

export function isPrivatePath(pathname: string): boolean {
  return privatePaths.includes(normalizePathname(pathname) as (typeof privatePaths)[number]);
}

export function safeReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    asciiControlCharacters.test(value)
  ) {
    return defaultReturnPath;
  }

  try {
    const parsedReturnUrl = new URL(value, safeReturnOrigin);

    if (parsedReturnUrl.origin !== safeReturnOrigin) {
      return defaultReturnPath;
    }
  } catch {
    return defaultReturnPath;
  }

  if (value === passwordRecoveryReturnPath) {
    return value;
  }

  const pathname = normalizePathname(value);

  if (authPaths.includes(pathname as (typeof authPaths)[number])) {
    return defaultReturnPath;
  }

  return value;
}
