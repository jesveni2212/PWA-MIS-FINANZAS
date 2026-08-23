import { describe, expect, it } from "vitest";

import {
  authPaths,
  isPrivatePath,
  privatePaths,
  safeReturnPath,
} from "@/lib/auth/paths";

describe("auth path contracts", () => {
  it("exposes the expected private and auth path lists", () => {
    expect(privatePaths).toEqual([
      "/resumen",
      "/movimientos",
      "/grupos",
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
    expect(safeReturnPath(null)).toBe("/resumen");
    expect(safeReturnPath("https://bad.test")).toBe("/resumen");
    expect(safeReturnPath("//bad.test")).toBe("/resumen");
    expect(safeReturnPath("/acceso")).toBe("/resumen");
  });

  it("marks only protected routes as private", () => {
    expect(isPrivatePath("/resumen")).toBe(true);
    expect(isPrivatePath("/movimientos")).toBe(true);
    expect(isPrivatePath("/grupos")).toBe(true);
    expect(isPrivatePath("/perfil")).toBe(true);
    expect(isPrivatePath("/")).toBe(false);
    expect(isPrivatePath("/acceso")).toBe(false);
    expect(isPrivatePath("/registro")).toBe(false);
    expect(isPrivatePath("/recuperar-contrasena")).toBe(false);
    expect(isPrivatePath("/api/health")).toBe(false);
  });
});
