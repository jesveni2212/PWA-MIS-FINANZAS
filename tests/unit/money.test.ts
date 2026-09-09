import { describe, expect, it } from "vitest";
import { formatMoneyInput, parseMoneyInput } from "@/lib/finance/money";

describe("money input formatting", () => {
  it("formats grouped integers and decimal values using the local convention", () => {
    expect(formatMoneyInput("500000")).toBe("500.000");
    expect(formatMoneyInput("50000.25")).toBe("50.000,25");
  });

  it("parses grouped local values and preserves decimal precision", () => {
    expect(parseMoneyInput("50.000,25")).toBe("50000.25");
    expect(parseMoneyInput("1.234.567,890")).toBe("1234567.890");
    expect(parseMoneyInput("50.25")).toBe("50.25");
    expect(parseMoneyInput("500.000")).toBe("500000");
  });

  it("handles incomplete and invalid input safely", () => {
    expect(parseMoneyInput("50000,")).toBe("50000.");
    expect(formatMoneyInput("50000.")).toBe("50.000,");
    expect(parseMoneyInput("Gs. 50.000,25")).toBe("50000.25");
    expect(parseMoneyInput("solo texto")).toBe("");
    expect(formatMoneyInput("")).toBe("");
  });
});
