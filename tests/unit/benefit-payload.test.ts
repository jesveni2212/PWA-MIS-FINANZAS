import { beforeEach, describe, expect, it, vi } from "vitest";

import { parsePersonalBenefitsPayload, PersonalBenefitsLoadError, personalBenefitsLoadError } from "@/lib/benefits/benefit-payload";
import { createPersonalBenefit, disablePersonalBenefit, duplicatePersonalBenefit, loadPersonalBenefits, updatePersonalBenefit } from "@/lib/benefits/repository";
import { loadPersonalBenefitsServer } from "@/lib/benefits/server";
import type { PersonalBenefitDraft } from "@/lib/benefits/types";
import { createClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const row = {
  id: "benefit-1", account_id: "card-1", account_label: "Banco · Visa",
  merchant_name: "Supermercado", merchant_aliases: ["Super"], benefit_type: "rebate",
  rate_bps: "2500", purchase_cap: "1000.10", rebate_cap: "250.03",
  used_purchase: "200.00", used_rebate: "50.00", currency: "PYG",
  recurrence: "monthly", weekdays: [1, 3], valid_from: "2026-09-01", valid_until: "2026-09-30",
  channel: "all", conditions: null, source_url: null, source_checked_at: null, status: "active",
};

describe("benefit payload", () => {
  it("maps the grouped RPC response and numeric strings to domain values", () => {
    expect(parsePersonalBenefitsPayload({ benefits: [row] })).toEqual([{
      id: "benefit-1", accountId: "card-1", accountLabel: "Banco · Visa",
      merchantName: "Supermercado", merchantAliases: ["Super"], benefitType: "rebate",
      rateBps: 2500, purchaseCap: 1000.1, rebateCap: 250.03, usedPurchase: 200, usedRebate: 50,
      currency: "PYG", recurrence: "monthly", weekdays: [1, 3], validFrom: "2026-09-01", validUntil: "2026-09-30",
      channel: "all", conditions: null, sourceUrl: null, sourceCheckedAt: null, status: "active",
    }]);
    expect(parsePersonalBenefitsPayload({ benefits: [] })).toEqual([]);
  });

  it.each([
    { id: undefined }, { id: " " }, { account_id: null }, { account_id: "" },
    { status: "approved" }, { purchase_cap: "NaN" }, { purchase_cap: -1 }, { purchase_cap: 0 },
    { purchase_cap: " " }, { purchase_cap: "0x10" }, { purchase_cap: "1000000000000" },
    { rebate_cap: -1 }, { rebate_cap: "Infinity" }, { rebate_cap: 999 },
    { rate_bps: "25.5" }, { rate_bps: 10001 }, { rate_bps: 0 },
    { used_purchase: -1 }, { used_rebate: false }, { weekdays: null }, { weekdays: "1,3" },
    { weekdays: [] }, { weekdays: [1, null] }, { weekdays: ["1"] }, { weekdays: [1.5] }, { weekdays: [7] },
    { merchant_aliases: [null] }, { benefit_type: "discount" }, { recurrence: "daily" }, { channel: "other" },
    { valid_from: "2026-09-31" }, { valid_until: "2026-08-01" }, { conditions: {} },
  ])("rejects malformed fields with a stable typed load error: %j", (patch) => {
    expect(() => parsePersonalBenefitsPayload({ benefits: [{ ...row, ...patch }] })).toThrow(PersonalBenefitsLoadError);
    expect(() => parsePersonalBenefitsPayload({ benefits: [{ ...row, ...patch }] })).toThrow(personalBenefitsLoadError);
  });

  it.each([null, [], {}, { benefits: null }, { benefits: {} }, { benefits: "secret SQL error" }, { benefits: [null] }])(
    "rejects non-array or malformed benefit payloads without leaking internals: %j", (payload) => {
      expect(() => parsePersonalBenefitsPayload(payload)).toThrow(personalBenefitsLoadError);
    },
  );
});

describe("benefit repositories", () => {
  const rpc = vi.fn();
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    rpc.mockReset().mockResolvedValue({ data: { benefits: [row] }, error: null });
    vi.mocked(createClient).mockReset().mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);
    vi.mocked(createServerClient).mockReset().mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createServerClient>>);
  });

  it("loads a typed month snapshot through the browser and server clients", async () => {
    expect(await loadPersonalBenefits("2026-09-01")).toEqual(parsePersonalBenefitsPayload({ benefits: [row] }));
    expect(await loadPersonalBenefitsServer("2026-09-01")).toEqual(parsePersonalBenefitsPayload({ benefits: [row] }));
    expect(rpc).toHaveBeenCalledWith("get_personal_benefits", { p_period_start: "2026-09-01" });
  });

  it("returns null offline without creating a browser client", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    expect(await loadPersonalBenefits("2026-09-01")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["rpc", "network", "payload", "client"])("sanitizes %s load failures in both repositories", async (failure) => {
    if (failure === "rpc") rpc.mockResolvedValue({ data: null, error: { message: "private SQL", code: "42501" } });
    if (failure === "network") rpc.mockRejectedValue(new TypeError("private network URL"));
    if (failure === "payload") rpc.mockResolvedValue({ data: { benefits: {} }, error: null });
    if (failure === "client") {
      vi.mocked(createClient).mockImplementation(() => { throw new Error("private config"); });
      vi.mocked(createServerClient).mockRejectedValue(new Error("private cookie"));
    }
    await expect(loadPersonalBenefits("2026-09-01")).rejects.toThrow(personalBenefitsLoadError);
    await expect(loadPersonalBenefitsServer("2026-09-01")).rejects.toThrow(personalBenefitsLoadError);
  });

  const draft: PersonalBenefitDraft = {
    accountId: "card-1", accountLabel: "Banco · Visa", merchantName: " Supermercado ",
    merchantAliases: [" ", " Super "], benefitType: "rebate", rateBps: 2500,
    purchaseCap: 1.005, rebateCap: 0.25, currency: "USD", recurrence: "monthly", weekdays: [1, 3],
    validFrom: "2026-09-01", validUntil: "2026-09-30", channel: "all",
    conditions: " ", sourceUrl: " ", sourceCheckedAt: null,
  };

  it("uses the mutation RPC contracts, normalizes optional text and preserves exact decimal input", async () => {
    rpc.mockResolvedValue({ data: "benefit-new", error: null });
    expect(await createPersonalBenefit(draft)).toBe("benefit-new");
    const args = {
      p_account_id: "card-1", p_merchant_name: "Supermercado", p_aliases: ["Super"], p_weekdays: [1, 3],
      p_valid_from: "2026-09-01", p_valid_until: "2026-09-30", p_rate_bps: 2500, p_purchase_cap: "1.005",
      p_currency: "USD", p_channel: "all", p_conditions: null, p_source_url: null, p_status: "draft",
    };
    expect(rpc).toHaveBeenLastCalledWith("create_personal_benefit", args);
    await createPersonalBenefit({ ...draft, merchantAliases: [] });
    expect(rpc).toHaveBeenLastCalledWith("create_personal_benefit", { ...args, p_aliases: null });
    await updatePersonalBenefit("benefit-1", { ...draft, status: "active" });
    expect(rpc).toHaveBeenLastCalledWith("update_personal_benefit", { ...args, p_benefit_id: "benefit-1", p_status: "active" });
    expect(await duplicatePersonalBenefit("benefit-1", "2026-10-01", "2026-10-31")).toBe("benefit-new");
    expect(rpc).toHaveBeenLastCalledWith("duplicate_personal_benefit", { p_benefit_id: "benefit-1", p_valid_from: "2026-10-01", p_valid_until: "2026-10-31" });
    await disablePersonalBenefit("benefit-1");
    expect(rpc).toHaveBeenLastCalledWith("disable_personal_benefit", { p_benefit_id: "benefit-1" });
  });

  it("rejects nonfinite amounts, fractional rates, malformed returned IDs, and private mutation errors", async () => {
    await expect(createPersonalBenefit({ ...draft, purchaseCap: Infinity })).rejects.toThrow(/guardar/);
    await expect(createPersonalBenefit({ ...draft, rateBps: 25.5 })).rejects.toThrow(/guardar/);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(createPersonalBenefit(draft)).rejects.toThrow(/guardar/);
    await expect(duplicatePersonalBenefit("benefit-1", "2026-10-01", "2026-10-31")).rejects.toThrow(/guardar/);
    rpc.mockRejectedValue(new Error("private SQL"));
    await expect(disablePersonalBenefit("benefit-1")).rejects.toThrow(/guardar/);
  });
});
