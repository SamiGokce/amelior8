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
