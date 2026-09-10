import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PwaRegister } from "@/components/pwa-register";

describe("PwaRegister", () => {
  it("registers the worker", () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<PwaRegister />);

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("keeps the worker limited to public static resources", () => {
    const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

    expect(source).toContain("mis-finanzas-static-v2");
    expect(source).toContain("/_next/static/");
    expect(source).not.toMatch(/cache\.add\(["']\/["']\)/);
    expect(source).not.toMatch(/caches\.match\(["']\/["']\)/);
    expect(source).toContain("request.mode === \"navigate\"");
  });
});
