import { parsePersonalBenefitsPayload, PersonalBenefitsLoadError } from "@/lib/benefits/benefit-payload";
import type { PersonalBenefit, PersonalBenefitDraft } from "@/lib/benefits/types";
import { createClient } from "@/lib/supabase/client";

export const personalBenefitSaveError = "No pudimos guardar el beneficio. Revisá los datos e intentá de nuevo.";

function nullableText(value: string | null): string | null {
  return value?.trim() || null;
}

function draftArguments(draft: PersonalBenefitDraft) {
  if (!Number.isSafeInteger(draft.rateBps) || draft.rateBps < 1 || draft.rateBps > 10_000
    || !Number.isFinite(draft.purchaseCap) || draft.purchaseCap <= 0 || draft.purchaseCap > 999_999_999_999.99) {
    throw new Error(personalBenefitSaveError);
  }
  const aliases = draft.merchantAliases.map((alias) => alias.trim()).filter(Boolean);
  return {
    p_account_id: draft.accountId,
    p_merchant_name: draft.merchantName.trim(),
    p_aliases: aliases.length ? aliases : null,
    p_weekdays: draft.weekdays,
    p_valid_from: draft.validFrom,
    p_valid_until: draft.validUntil,
    p_rate_bps: draft.rateBps,
    // PostgreSQL rounds numeric to numeric(14,2) exactly. Avoid binary toFixed
    // rounding (e.g. 1.005) before it reaches the authoritative RPC.
    p_purchase_cap: draft.purchaseCap.toString(),
    p_currency: draft.currency,
    p_channel: draft.channel,
    p_conditions: nullableText(draft.conditions),
    p_source_url: nullableText(draft.sourceUrl),
    p_status: draft.status ?? "draft",
  };
}

export async function loadPersonalBenefits(periodStart: string): Promise<PersonalBenefit[] | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    const { data, error } = await createClient().rpc("get_personal_benefits", { p_period_start: periodStart });
    if (error) throw new PersonalBenefitsLoadError();
    return parsePersonalBenefitsPayload(data);
  } catch {
    throw new PersonalBenefitsLoadError();
  }
}

async function mutate(name: string, args: Record<string, unknown>, returnsId: boolean): Promise<string | null> {
  try {
    const { data, error } = await createClient().rpc(name, args);
    if (error || (returnsId && (typeof data !== "string" || !data.trim()))) throw new Error(personalBenefitSaveError);
    return returnsId ? data as string : null;
  } catch {
    throw new Error(personalBenefitSaveError);
  }
}

export async function createPersonalBenefit(draft: PersonalBenefitDraft): Promise<string> {
  return await mutate("create_personal_benefit", draftArguments(draft), true) as string;
}

export async function updatePersonalBenefit(id: string, draft: PersonalBenefitDraft): Promise<void> {
  await mutate("update_personal_benefit", { ...draftArguments(draft), p_benefit_id: id }, false);
}

export async function duplicatePersonalBenefit(id: string, validFrom: string, validUntil: string): Promise<string> {
  return await mutate("duplicate_personal_benefit", { p_benefit_id: id, p_valid_from: validFrom, p_valid_until: validUntil }, true) as string;
}

export async function disablePersonalBenefit(id: string): Promise<void> {
  await mutate("disable_personal_benefit", { p_benefit_id: id }, false);
}
