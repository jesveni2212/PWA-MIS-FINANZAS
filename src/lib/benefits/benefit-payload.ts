import { calculateRebateCap } from "@/lib/benefits/matching";
import type { PersonalBenefit } from "@/lib/benefits/types";

export const personalBenefitsLoadError = "No pudimos cargar tus beneficios personales. Volvé a intentar.";

export class PersonalBenefitsLoadError extends Error {
  constructor() {
    super(personalBenefitsLoadError);
    this.name = "PersonalBenefitsLoadError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PersonalBenefitsLoadError();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new PersonalBenefitsLoadError();
  return value;
}

function nullableText(value: unknown): string | null {
  if (value !== null && typeof value !== "string") throw new PersonalBenefitsLoadError();
  return value;
}

function numberValue(value: unknown): number {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value))) {
    throw new PersonalBenefitsLoadError();
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new PersonalBenefitsLoadError();
  return number;
}

function money(value: unknown): number {
  const number = numberValue(value);
  if (number > 999_999_999_999.99) throw new PersonalBenefitsLoadError();
  return number;
}

function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result) {
    throw new PersonalBenefitsLoadError();
  }
  return result;
}

function parseBenefit(value: unknown): PersonalBenefit {
  const row = record(value);
  if (row.benefit_type !== "rebate"
    || (row.status !== "draft" && row.status !== "active" && row.status !== "expired" && row.status !== "disabled")
    || (row.recurrence !== "monthly" && row.recurrence !== "weekly")
    || (row.channel !== "all" && row.channel !== "physical" && row.channel !== "app" && row.channel !== "web")
    || (row.currency !== "PYG" && row.currency !== "USD")) throw new PersonalBenefitsLoadError();

  const rateBps = numberValue(row.rate_bps);
  const purchaseCap = money(row.purchase_cap);
  const rebateCap = money(row.rebate_cap);
  if (!Number.isSafeInteger(rateBps) || rateBps < 1 || rateBps > 10_000 || purchaseCap <= 0
    || rebateCap !== calculateRebateCap(purchaseCap, rateBps)) throw new PersonalBenefitsLoadError();
  if (!Array.isArray(row.merchant_aliases)) throw new PersonalBenefitsLoadError();
  if (!Array.isArray(row.weekdays) || row.weekdays.length === 0
    || row.weekdays.some((day) => typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new PersonalBenefitsLoadError();
  }
  const validFrom = date(row.valid_from);
  const validUntil = date(row.valid_until);
  if (validUntil < validFrom) throw new PersonalBenefitsLoadError();

  return {
    id: text(row.id), accountId: text(row.account_id), accountLabel: text(row.account_label),
    merchantName: text(row.merchant_name), merchantAliases: row.merchant_aliases.map(text),
    benefitType: row.benefit_type, rateBps, purchaseCap, rebateCap,
    usedPurchase: numberValue(row.used_purchase), usedRebate: numberValue(row.used_rebate),
    currency: row.currency, recurrence: row.recurrence, weekdays: [...row.weekdays], validFrom, validUntil,
    channel: row.channel, conditions: nullableText(row.conditions), sourceUrl: nullableText(row.source_url),
    sourceCheckedAt: nullableText(row.source_checked_at), status: row.status,
  };
}

export function parsePersonalBenefitsPayload(payload: unknown): PersonalBenefit[] {
  try {
    const grouped = record(payload);
    if (!Array.isArray(grouped.benefits)) throw new PersonalBenefitsLoadError();
    return grouped.benefits.map(parseBenefit);
  } catch {
    throw new PersonalBenefitsLoadError();
  }
}
