import type {
  BenefitMatchInput,
  BenefitPreview,
  PersonalBenefit,
} from "./types";

export function normalizeMerchant(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateRebateCap(purchaseCap: number, rateBps: number): number {
  return Math.round((purchaseCap * rateBps) / 10_000);
}

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function matchesBenefit(benefit: PersonalBenefit, input: BenefitMatchInput): boolean {
  if (
    benefit.accountId !== input.accountId ||
    benefit.status !== "active" ||
    benefit.currency !== input.currency ||
    !isValidDate(input.occurredOn) ||
    input.occurredOn < benefit.validFrom ||
    input.occurredOn > benefit.validUntil ||
    (input.channel && benefit.channel !== "all" && benefit.channel !== input.channel)
  ) {
    return false;
  }

  const weekday = new Date(`${input.occurredOn}T00:00:00.000Z`).getUTCDay();
  if (benefit.weekdays.length > 0 && !benefit.weekdays.includes(weekday)) return false;

  const merchant = normalizeMerchant(input.merchant);
  return [benefit.merchantName, ...benefit.merchantAliases].some(
    (candidate) => normalizeMerchant(candidate) === merchant,
  );
}

export function findMatchingBenefit(
  benefits: PersonalBenefit[],
  input: BenefitMatchInput,
): PersonalBenefit | null {
  const matches = benefits.filter((benefit) => matchesBenefit(benefit, input));
  return matches.length === 1 ? matches[0] : null;
}

export function calculateBenefitPreview(
  benefit: PersonalBenefit,
  input: Pick<BenefitMatchInput, "amount" | "occurredOn">,
): BenefitPreview {
  const purchaseRemaining = Math.max(0, benefit.purchaseCap - benefit.usedPurchase);
  const rebateRemaining = Math.max(0, benefit.rebateCap - benefit.usedRebate);
  const requestedAmount = Math.max(0, input.amount);
  const eligibleByRebate = benefit.rateBps > 0
    ? Math.floor((rebateRemaining * 10_000) / benefit.rateBps)
    : 0;
  const eligiblePurchase = Math.min(requestedAmount, purchaseRemaining, eligibleByRebate);
  const estimatedRebate = Math.min(
    rebateRemaining,
    Math.round((eligiblePurchase * benefit.rateBps) / 10_000),
  );

  return {
    eligiblePurchase,
    estimatedRebate,
    purchaseRemaining: Math.max(0, purchaseRemaining - eligiblePurchase),
    rebateRemaining: Math.max(0, rebateRemaining - estimatedRebate),
  };
}
