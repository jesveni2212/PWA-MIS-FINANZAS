import type {
  BenefitMatchInput,
  BenefitPreview,
  PersonalBenefit,
} from "./types";

// Money uses the database numeric(14,2) contract: quantize half-up to two decimals.
const MONEY_DECIMAL_PLACES = 2;
const MONEY_MINOR_UNIT_SCALE = 10n ** BigInt(MONEY_DECIMAL_PLACES);

export function normalizeMerchant(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toMinorUnits(value: number): bigint {
  if (!Number.isFinite(value)) throw new RangeError("Benefit amounts must be finite numbers");

  const text = Math.abs(value).toString().toLowerCase();
  const [coefficient, exponentText] = text.split("e");
  const exponent = exponentText ? Number(exponentText) : 0;
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = BigInt(`${whole}${fraction}`);
  const decimalPlaces = fraction.length - exponent;
  const shift = MONEY_DECIMAL_PLACES - decimalPlaces;
  const magnitude = shift >= 0
    ? digits * 10n ** BigInt(shift)
    : (() => {
        const divisor = 10n ** BigInt(-shift);
        const quotient = digits / divisor;
        const remainder = digits % divisor;
        return quotient + (remainder * 2n >= divisor ? 1n : 0n);
      })();

  return value < 0 ? -magnitude : magnitude;
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const quotient = magnitude / denominator;
  const remainder = magnitude % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

function fromMinorUnits(value: bigint): number {
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  const whole = magnitude / MONEY_MINOR_UNIT_SCALE;
  const fraction = (magnitude % MONEY_MINOR_UNIT_SCALE)
    .toString()
    .padStart(MONEY_DECIMAL_PLACES, "0");
  return Number(`${sign}${whole}.${fraction}`);
}

function toRateUnits(rateBps: number): bigint {
  if (!Number.isSafeInteger(rateBps)) throw new RangeError("Benefit rates must be safe integers");
  return BigInt(rateBps);
}

export function calculateRebateCap(purchaseCap: number, rateBps: number): number {
  return fromMinorUnits(roundHalfUp(toMinorUnits(purchaseCap) * toRateUnits(rateBps), 10_000n));
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
  const purchaseAmountRemaining = toMinorUnits(benefit.purchaseCap) - toMinorUnits(benefit.usedPurchase);
  const rebateAmountRemaining = toMinorUnits(benefit.rebateCap) - toMinorUnits(benefit.usedRebate);
  const purchaseRemaining = purchaseAmountRemaining > 0n ? purchaseAmountRemaining : 0n;
  const rebateRemaining = rebateAmountRemaining > 0n ? rebateAmountRemaining : 0n;
  const requestedAmount = toMinorUnits(input.amount);
  const rate = toRateUnits(benefit.rateBps);
  let eligiblePurchase = requestedAmount > 0n ? requestedAmount : 0n;
  if (eligiblePurchase > purchaseRemaining) eligiblePurchase = purchaseRemaining;
  if (rate <= 0n || rebateRemaining <= 0n) {
    eligiblePurchase = 0n;
  } else {
    // The strict half-up boundary prevents rounding the rebate above its cap.
    const eligibleByRebate = (((rebateRemaining * 2n + 1n) * 10_000n) - 1n) / (rate * 2n);
    if (eligiblePurchase > eligibleByRebate) eligiblePurchase = eligibleByRebate;
  }
  const estimatedRebate = roundHalfUp(eligiblePurchase * rate, 10_000n);

  return {
    eligiblePurchase: fromMinorUnits(eligiblePurchase),
    estimatedRebate: fromMinorUnits(estimatedRebate),
    purchaseRemaining: fromMinorUnits(purchaseRemaining - eligiblePurchase),
    rebateRemaining: fromMinorUnits(rebateRemaining - estimatedRebate),
  };
}
