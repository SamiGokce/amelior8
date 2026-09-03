import Stripe from "stripe";

let client = null;

/** Test vs live is an env-var change only — never a code change. */
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!client) client = new Stripe(key, { apiVersion: "2024-06-20" });
  return client;
}

export const isLiveMode = () => (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live");

/**
 * The one place a gift's price is decided. Reads from the stored item, never
 * from anything the client sent.
 */
export function priceBreakdown(item, quantity = 1) {
  const q = Math.max(1, Math.min(10, Math.floor(quantity) || 1));
  const giftAmount = item.priceUsdCents * q;
  const facilitatorFee = item.facilitatorFeeUsdCents * q;
  const platformFee = item.platformFeeUsdCents * q;
  return {
    quantity: q,
    giftAmount,
    facilitatorFee,
    platformFee,
    totalCharged: giftAmount + facilitatorFee + platformFee,
  };
}
