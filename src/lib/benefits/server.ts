import { parsePersonalBenefitsPayload, PersonalBenefitsLoadError } from "@/lib/benefits/benefit-payload";
import type { PersonalBenefit } from "@/lib/benefits/types";
import { createClient } from "@/lib/supabase/server";

export async function loadPersonalBenefitsServer(periodStart: string): Promise<PersonalBenefit[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_personal_benefits", { p_period_start: periodStart });
    if (error) throw new PersonalBenefitsLoadError();
    return parsePersonalBenefitsPayload(data);
  } catch {
    throw new PersonalBenefitsLoadError();
  }
}
