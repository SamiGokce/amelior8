import { describe, expect, it } from "vitest";
import {
  VERIFICATION_FEE_USD_CENTS,
  donorLineItems,
  priceBreakdown,
  splitVerificationFee,
} from "../shared/fees.js";

const item = { priceUsdCents: 4200 };

describe("the verification fee", () => {
  it("is a flat $5", () => {
    expect(VERIFICATION_FEE_USD_CENTS).toBe(500);
  });

  it("splits evenly", () => {
    expect(splitVerificationFee(500)).toEqual({ platform: 250, partner: 250 });
  });

  it("gives an odd cent to the partner, not to us", () => {
    const { platform, partner } = splitVerificationFee(501);
    expect(platform).toBe(250);
    expect(partner).toBe(251);
    expect(platform + partner).toBe(501);
  });

  it("never loses or invents a cent", () => {
    for (const fee of [0, 1, 99, 500, 501, 12345]) {
      const { platform, partner } = splitVerificationFee(fee);
      expect(platform + partner).toBe(fee);
    }
  });
});

describe("order pricing", () => {
  it("charges the gift plus one flat fee", () => {
    const p = priceBreakdown(item, 1);
    expect(p.giftAmount).toBe(4200);
    expect(p.verificationFee).toBe(500);
    expect(p.totalCharged).toBe(4700);
  });

  // The fee is per order. Quantity must not multiply it.
  it("does not multiply the fee by quantity", () => {
    const p = priceBreakdown(item, 3);
    expect(p.giftAmount).toBe(12600);
    expect(p.verificationFee).toBe(500);
    expect(p.totalCharged).toBe(13100);
  });

  it("reconciles exactly with what Stripe moves", () => {
    // A destination charge sends (total - application_fee) to the partner.
    for (const q of [1, 2, 5, 10]) {
      const p = priceBreakdown(item, q);
      expect(p.totalCharged - p.platformFee).toBe(p.transferToPartner);
      expect(p.transferToPartner).toBe(p.giftAmount + p.partnerFeeShare);
    }
  });

  it("sends 100% of the gift to the partner", () => {
    const p = priceBreakdown(item, 2);
    expect(p.transferToPartner - p.partnerFeeShare).toBe(p.giftAmount);
  });

  it("keeps quantity within bounds", () => {
    expect(priceBreakdown(item, 0).quantity).toBe(1);
    expect(priceBreakdown(item, -5).quantity).toBe(1);
    expect(priceBreakdown(item, 999).quantity).toBe(10);
  });

  it("takes only half the fee as our application fee", () => {
    const p = priceBreakdown(item, 1);
    expect(p.platformFee).toBe(250);
    expect(p.platformFee).toBe(Math.floor(p.verificationFee / 2));
  });
});

describe("what the donor is shown", () => {
  // A trust requirement: the gift and the fee are never blended.
  it("is always two separate lines", () => {
    const lines = donorLineItems(priceBreakdown(item, 1));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ label: "Your gift", amountUsdCents: 4200 });
    expect(lines[1]).toEqual({ label: "Verified delivery", amountUsdCents: 500 });
  });

  it("adds up to what is charged", () => {
    const p = priceBreakdown(item, 4);
    const sum = donorLineItems(p).reduce((t, l) => t + l.amountUsdCents, 0);
    expect(sum).toBe(p.totalCharged);
  });
});
