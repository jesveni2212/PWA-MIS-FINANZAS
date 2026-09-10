import { describe, expect, it } from "vitest";

import {
  authPaths,
  isPrivatePath,
  privatePaths,
  registrationConfirmationPath,
  safeReturnPath,
} from "@/lib/auth/paths";

describe("auth path contracts", () => {
  it("exposes the expected private and auth path lists", () => {
    expect(privatePaths).toEqual([
      "/",
      "/cuentas",
      "/movimientos",
      "/grupos",
      "/recordatorios",
      "/perfil",
    ]);
    expect(authPaths).toEqual([
      "/acceso",
      "/registro",
      "/recuperar-contrasena",
    ]);
  });

  it("accepts only safe internal return paths", () => {
    expect(safeReturnPath("/perfil")).toBe("/perfil");
    expect(safeReturnPath("/movimientos?mes=8")).toBe("/movimientos?mes=8");
    expect(safeReturnPath("/recuperar-contrasena?modo=restablecer")).toBe(
      "/recuperar-contrasena?modo=restablecer",
    );
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath("https://bad.test")).toBe("/");
    expect(safeReturnPath("//bad.test")).toBe("/");
    expect(safeReturnPath("/\\evil.test")).toBe("/");
    expect(safeReturnPath("/acceso")).toBe("/");
    expect(safeReturnPath("/recuperar-contrasena?modo=otro")).toBe("/");
  });

  it("marks only protected routes as private", () => {
    expect(isPrivatePath("/")).toBe(true);
    expect(isPrivatePath("/cuentas")).toBe(true);
    expect(isPrivatePath("/movimientos")).toBe(true);
    expect(isPrivatePath("/grupos")).toBe(true);
    expect(isPrivatePath("/recordatorios")).toBe(true);
    expect(isPrivatePath("/perfil")).toBe(true);
    expect(isPrivatePath("/acceso")).toBe(false);
    expect(isPrivatePath("/registro")).toBe(false);
    expect(isPrivatePath("/recuperar-contrasena")).toBe(false);
    expect(isPrivatePath("/api/health")).toBe(false);
  });

  it("keeps the registration confirmation route public and safe", () => {
    expect(registrationConfirmationPath).toBe("/registro-confirmado");
    expect(isPrivatePath(registrationConfirmationPath)).toBe(false);
    expect(safeReturnPath(registrationConfirmationPath)).toBe(registrationConfirmationPath);
  });
});
