import { describe, expect, it } from "vitest";
import { calculateNextDueDate } from "@/lib/reminders/recurrence";

describe("reminder recurrence", () => {
  it("advances weekly dates", () => {
    expect(calculateNextDueDate("2026-09-10", { type: "weekly", weekday: 4 })).toBe("2026-09-17");
  });

  it("clamps a monthly day 31 to the end of February", () => {
    expect(calculateNextDueDate("2026-01-31", { type: "monthly", day: 31 })).toBe("2026-02-28");
  });

  it("clamps leap-day annual reminders in non-leap years", () => {
    expect(calculateNextDueDate("2028-02-29", { type: "annual", month: 2, day: 29 })).toBe("2029-02-28");
  });

  it("supports custom month intervals", () => {
    expect(calculateNextDueDate("2026-09-09", { type: "custom", interval: 2, unit: "months" })).toBe("2026-11-09");
  });

  it.each([
    { type: "weekly", weekday: 7 },
    { type: "monthly", day: 0 },
    { type: "annual", month: 13, day: 1 },
    { type: "custom", interval: 0, unit: "days" },
  ] as const)("rejects invalid rule %#", (rule) => {
    expect(() => calculateNextDueDate("2026-09-09", rule)).toThrow();
  });

  it("rejects invalid ISO dates", () => {
    expect(() => calculateNextDueDate("2026-02-30", { type: "monthly", day: 1 })).toThrow();
  });
});
