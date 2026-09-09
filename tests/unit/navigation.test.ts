import { describe, expect, it } from "vitest";
import { isNavigationItemActive } from "@/lib/navigation";

describe("isNavigationItemActive", () => {
  it("matches the root route only at the root", () => {
    expect(isNavigationItemActive("/", "/")).toBe(true);
    expect(isNavigationItemActive("/cuentas", "/")).toBe(false);
  });

  it("matches exact and child routes without matching a similar prefix", () => {
    expect(isNavigationItemActive("/movimientos", "/movimientos")).toBe(true);
    expect(isNavigationItemActive("/movimientos/detalle", "/movimientos")).toBe(true);
    expect(isNavigationItemActive("/movimientos-extra", "/movimientos")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    expect(isNavigationItemActive("/cuentas/", "/cuentas")).toBe(true);
    expect(isNavigationItemActive("/cuentas", "/cuentas/")).toBe(true);
  });
});
