export const registrationConfirmationPath = "/registro-confirmado" as const;

export const privatePaths = [
  "/",
  "/movimientos",
  "/grupos",
  "/perfil",
] as const;

export const authPaths = [
  "/acceso",
  "/registro",
  "/recuperar-contrasena",
] as const;

const defaultReturnPath = "/";

function normalizePathname(value: string): string {
  return value.split("?")[0]?.split("#")[0] ?? value;
}

export function isPrivatePath(pathname: string): boolean {
  return privatePaths.includes(normalizePathname(pathname) as (typeof privatePaths)[number]);
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return defaultReturnPath;
  }

  const pathname = normalizePathname(value);

  if (authPaths.includes(pathname as (typeof authPaths)[number])) {
    return defaultReturnPath;
  }

  return value;
}
