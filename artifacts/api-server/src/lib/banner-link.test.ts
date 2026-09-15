import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveProductOffer } from "./banner-link.ts";

const noOffer = { discountTiers: [], discountThreshold: null, discountPercent: null };

test("accepts a product with a current discount tier", () => {
  assert.equal(hasActiveProductOffer({
    ...noOffer,
    discountTiers: [{ threshold: 10, amountOffUsd: 0.5 }],
  }), true);
});

test("accepts legacy discount fields", () => {
  assert.equal(hasActiveProductOffer({
    ...noOffer,
    discountThreshold: 10,
    discountPercent: "5",
  }), true);
});

test("rejects products without an active offer", () => {
  assert.equal(hasActiveProductOffer(noOffer), false);
  assert.equal(hasActiveProductOffer({
    ...noOffer,
    discountTiers: [{ threshold: 10, amountOffUsd: 0 }],
  }), false);
});
