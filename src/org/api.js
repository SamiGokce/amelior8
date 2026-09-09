import { request } from "../lib/request";

export const orgApi = {
  me: () => request("/org/me"),

  /** view: "open" | "unassigned" | "review" | "all"; or relayId to filter. */
  orders: ({ view = "open", relayId } = {}) => {
    const q = new URLSearchParams({ view });
    if (relayId) q.set("relayId", relayId);
    return request(`/org/orders?${q}`);
  },

  assign: (orderId, { relayId, recipient }) =>
    request(`/org/orders/${orderId}/assign`, { method: "POST", body: { relayId, recipient } }),

  /** Everything needed to decide on a delivery: photos, receipt, AI verdict. */
  reviewDetail: (orderId) => request(`/org/orders/${orderId}/review`),

  review: (orderId, decision, note) =>
    request(`/org/orders/${orderId}/review`, { method: "POST", body: { decision, note } }),

  relays: () => request("/org/relays"),

  createRelay: (payload) => request("/org/relays", { method: "POST", body: payload }),

  updateRelay: (relayId, payload) =>
    request(`/org/relays/${relayId}`, { method: "PATCH", body: payload }),

  team: () => request("/org/invites"),

  invite: (email, role) => request("/org/invites", { method: "POST", body: { email, role } }),

  acceptInvite: (token) => request("/invites/accept", { method: "POST", body: { token } }),

  stripeStatus: () => request("/org/stripe"),
  startStripeOnboarding: () => request("/org/stripe", { method: "POST" }),
  payouts: () => request("/org/payouts"),
};
