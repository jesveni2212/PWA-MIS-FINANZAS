export type BenefitStatus = "draft" | "active" | "expired" | "disabled";
export type BenefitType = "rebate";
export type BenefitRecurrence = "monthly" | "weekly";
export type BenefitChannel = "all" | "physical" | "app" | "web";

export type PersonalBenefit = {
  id: string;
  accountId: string;
  accountLabel: string;
  merchantName: string;
  merchantAliases: string[];
  benefitType: BenefitType;
  rateBps: number;
  purchaseCap: number;
  rebateCap: number;
  usedPurchase: number;
  usedRebate: number;
  currency: string;
  recurrence: BenefitRecurrence;
  weekdays: number[];
  validFrom: string;
  validUntil: string;
  channel: BenefitChannel;
  conditions: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  status: BenefitStatus;
};

export type PersonalBenefitDraft = Omit<
  PersonalBenefit,
  "id" | "usedPurchase" | "usedRebate" | "status"
> & { status?: BenefitStatus };

export type BenefitSummary = {
  benefitCount: number;
  activeCount: number;
  totalPurchaseCap: number;
  totalRebateCap: number;
  usedPurchase: number;
  usedRebate: number;
  currency: string;
};

export type BenefitMatchInput = {
  accountId: string;
  merchant: string;
  amount: number;
  occurredOn: string;
  currency: string;
  channel?: BenefitChannel;
};

export type BenefitPreview = {
  eligiblePurchase: number;
  estimatedRebate: number;
  purchaseRemaining: number;
  rebateRemaining: number;
};
