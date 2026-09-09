import { parsePersonalLedgerPayload, personalLedgerLoadError } from "@/lib/finance/ledger-payload";
import type { PersonalLedger } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/server";

export async function loadPersonalLedgerServer(limit = 50): Promise<PersonalLedger> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_personal_ledger", { p_limit: limit });
    if (error) throw new Error(personalLedgerLoadError);

    return parsePersonalLedgerPayload(data);
  } catch {
    throw new Error(personalLedgerLoadError);
  }
}
