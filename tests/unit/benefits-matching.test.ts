import { describe, expect, it } from "vitest";
import type { PersonalBenefit } from "@/lib/benefits/types";
import {
  calculateBenefitPreview,
  calculateRebateCap,
  findMatchingBenefit,
  normalizeMerchant,
} from "@/lib/benefits/matching";

const benefit: PersonalBenefit = {
  id: "benefit-1",
  accountId: "card-1",
  accountLabel: "Eko · Visa",
  merchantName: "Biggie",
  merchantAliases: ["Biggie Express"],
  benefitType: "rebate",
  rateBps: 2000,
  purchaseCap: 600000,
  rebateCap: 120000,
  usedPurchase: 300000,
  usedRebate: 60000,
  currency: "PYG",
  recurrence: "monthly",
  weekdays: [2],
  validFrom: "2026-09-01",
  validUntil: "2026-09-30",
  channel: "all",
  conditions: null,
  sourceUrl: null,
  sourceCheckedAt: null,
  status: "active",
};

const input = {
  accountId: "card-1",
  merchant: "Biggie",
  amount: 85000,
  occurredOn: "2026-09-15",
  currency: "PYG",
};

describe("benefit calculations", () => {
  it("derives the 20 percent rebate cap and remaining amounts", () => {
    expect(calculateRebateCap(600000, 2000)).toBe(120000);
    expect(calculateBenefitPreview(benefit, { amount: 85000, occurredOn: "2026-09-15" })).toMatchObject({
      eligiblePurchase: 85000,
      estimatedRebate: 17000,
      purchaseRemaining: 215000,
      rebateRemaining: 43000,
    });
  });

  it("does not consume more than either remaining cap", () => {
    expect(calculateBenefitPreview({ ...benefit, usedPurchase: 580000, usedRebate: 116000 }, { amount: 50000, occurredOn: "2026-09-22" })).toMatchObject({
      eligiblePurchase: 20000,
      estimatedRebate: 4000,
      purchaseRemaining: 0,
      rebateRemaining: 0,
    });
  });

  it("returns no eligible purchase when a cap is exhausted", () => {
    expect(calculateBenefitPreview({ ...benefit, usedPurchase: 600000 }, { amount: 10000, occurredOn: "2026-09-15" })).toMatchObject({
      eligiblePurchase: 0,
      estimatedRebate: 0,
      purchaseRemaining: 0,
    });
  });
});

describe("benefit matching", () => {
  it("normalizes Spanish accents, punctuation, and whitespace", () => {
    expect(normalizeMerchant("  CAFÉ,  Ñandú S.A. ")).toBe("cafe nandu sa");
  });

  it("matches a configured merchant alias", () => {
    expect(findMatchingBenefit([benefit], { ...input, merchant: "BIGGIE EXPRESS" })).toBe(benefit);
  });

  it.each([
    ["a non-matching merchant", { ...input, merchant: "Stock" }],
    ["a different account", { ...input, accountId: "card-2" }],
    ["a different currency", { ...input, currency: "USD" }],
    ["a Wednesday purchase against a Tuesday rule", { ...input, occurredOn: "2026-09-16" }],
    ["a date before the validity window", { ...input, occurredOn: "2026-08-31" }],
    ["a date after the validity window", { ...input, occurredOn: "2026-10-01" }],
  ])("does not match %s", (_description, matchInput) => {
    expect(findMatchingBenefit([benefit], matchInput)).toBeNull();
  });

  it("does not match draft rules", () => {
    expect(findMatchingBenefit([{ ...benefit, status: "draft" }], input)).toBeNull();
  });

  it("returns null when equally specific active candidates are ambiguous", () => {
    expect(findMatchingBenefit([benefit, { ...benefit, id: "benefit-2" }], input)).toBeNull();
  });
});
