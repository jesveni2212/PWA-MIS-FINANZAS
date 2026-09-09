import { registrationConfirmationPath } from "@/lib/auth/paths";

export type RegistrationConfirmationStatus = "exitoso" | "error";

export function getRegistrationConfirmationRedirect(origin: string): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", registrationConfirmationPath);
  return callbackUrl.toString();
}

export function getRegistrationConfirmationPagePath(status: RegistrationConfirmationStatus = "exitoso"): string {
  return `${registrationConfirmationPath}?estado=${status}`;
}
