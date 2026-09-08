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
      "/",
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
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath("https://bad.test")).toBe("/");
    expect(safeReturnPath("//bad.test")).toBe("/");
    expect(safeReturnPath("/acceso")).toBe("/");
  });

  it("marks only protected routes as private", () => {
    expect(isPrivatePath("/")).toBe(true);
    expect(isPrivatePath("/movimientos")).toBe(true);
    expect(isPrivatePath("/grupos")).toBe(true);
    expect(isPrivatePath("/perfil")).toBe(true);
    expect(isPrivatePath("/acceso")).toBe(false);
    expect(isPrivatePath("/registro")).toBe(false);
    expect(isPrivatePath("/recuperar-contrasena")).toBe(false);
    expect(isPrivatePath("/api/health")).toBe(false);
  });
});
