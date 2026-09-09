// The money model, in one place.
//
// A gift's price goes 100% to the partner organisation through Stripe Connect.
// On top of it sits a flat, per-order verification fee, split evenly between
// Amelior8 and the partner.
//
// Amelior8 never holds donor funds: the charge settles with the partner's own
// connected account, and our half is taken as a Stripe application fee at the
// moment of payment.

/** Flat, per-order. Not per item, and not multiplied by quantity. */
export const VERIFICATION_FEE_USD_CENTS = 500;

/**
 * How the verification fee divides.
 *
 * `platform` is taken by Stripe as `application_fee_amount`; `partner` rides
 * along in the destination transfer and is reconciled monthly in `payouts`.
 *
 * Odd cents go to the partner rather than to us.
 */
export function splitVerificationFee(feeUsdCents = VERIFICATION_FEE_USD_CENTS) {
  const platform = Math.floor(feeUsdCents / 2);
  return { platform, partner: feeUsdCents - platform };
}

/**
 * The full breakdown for an order. The only place a price is computed.
 *
 * @param {{priceUsdCents: number}} item   as stored in giftItems
 * @param {number} quantity
 * @param {number} verificationFeeUsdCents override for the flat fee
 */
export function priceBreakdown(item, quantity = 1, verificationFeeUsdCents = VERIFICATION_FEE_USD_CENTS) {
  const q = Math.max(1, Math.min(10, Math.floor(quantity) || 1));
  const giftAmount = item.priceUsdCents * q;
  const fee = verificationFeeUsdCents;
  const { platform, partner } = splitVerificationFee(fee);

  return {
    quantity: q,
    giftAmount,                       // 100% to the partner
    verificationFee: fee,             // flat, per order
    platformFee: platform,            // Stripe application_fee_amount
    partnerFeeShare: partner,         // rides the transfer, reconciled monthly
    totalCharged: giftAmount + fee,   // what the donor pays
    // What Stripe moves to the connected account, by construction
    // totalCharged - application_fee_amount.
    transferToPartner: giftAmount + partner,
  };
}

/**
 * The two lines a donor sees before paying. Deliberately not collapsible into
 * one number — separating the gift from the fee is a trust requirement.
 */
export function donorLineItems(breakdown) {
  return [
    { label: "Your gift", amountUsdCents: breakdown.giftAmount },
    { label: "Verified delivery", amountUsdCents: breakdown.verificationFee },
  ];
}
