// Typed-ish fetch wrapper for /api. Every authenticated call carries the
// Firebase ID token; the server verifies it on each request.

import { auth } from "./firebase";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, authed = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (authed) {
    const user = auth.currentUser;
    if (!user) throw new ApiError("You need to be signed in.", 401, "unauthenticated");
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response (a proxy error page, say) — surface the status instead.
  }

  if (!res.ok) {
    throw new ApiError(
      payload?.error || `Request failed (${res.status})`,
      res.status,
      payload?.code || "unknown",
    );
  }

  return payload;
}

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
