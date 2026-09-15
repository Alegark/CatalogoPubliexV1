import { discountTierSchema, legacyDiscountTierSchema } from "@workspace/db";

type ProductOfferFields = {
  discountTiers: unknown;
  discountThreshold: number | null;
  discountPercent: string | null;
};

export function hasActiveProductOffer(product: ProductOfferFields): boolean {
  const hasTierOffer = Array.isArray(product.discountTiers)
    && product.discountTiers.some((tier) => {
      const parsed = discountTierSchema.safeParse(tier);
      if (parsed.success) return parsed.data.amountOffUsd > 0;
      const legacy = legacyDiscountTierSchema.safeParse(tier);
      return legacy.success && legacy.data.percent > 0;
    });

  return hasTierOffer || (
    product.discountThreshold !== null
    && product.discountThreshold > 0
    && Number(product.discountPercent ?? 0) > 0
  );
}
