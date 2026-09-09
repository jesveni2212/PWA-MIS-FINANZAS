import { describe, expect, it } from "vitest";
import { getGreetingLabel } from "@/lib/auth/greeting";

describe("greeting labels", () => {
  it("uses a trimmed profile name", () => {
    expect(getGreetingLabel("  Ana  ")).toBe("Hola, Ana");
  });

  it("does not expose an email when the profile name is unavailable", () => {
    expect(getGreetingLabel("")).toBe("Bienvenido/a");
    expect(getGreetingLabel("   ")).toBe("Bienvenido/a");
    expect(getGreetingLabel(null)).toBe("Bienvenido/a");
    expect(getGreetingLabel(undefined)).toBe("Bienvenido/a");
  });
});
