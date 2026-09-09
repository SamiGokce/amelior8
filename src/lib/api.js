// Donor-facing API calls. The shared transport lives in request.js.

import { request } from "./request";

export { ApiError } from "./request";

export const api = {
  /** Creates the order + Stripe Checkout Session. Price is computed server-side. */
  createCheckoutSession: (itemId, { mode = "payment", quantity = 1 } = {}) =>
    request("/checkout/session", { method: "POST", body: { itemId, mode, quantity } }),

  listSubscriptions: () => request("/subscriptions"),

  cancelSubscription: (subscriptionId) =>
    request("/subscriptions/cancel", { method: "POST", body: { subscriptionId } }),

  /** Short-lived signed URL for reading this order's proof photo. */
  getProofUrl: (orderId) => request(`/orders/${orderId}/proof-url`),
};
