import { request, uploadToSignedUrl } from "../lib/request";

export const relayApi = {
  me: () => request("/relay/me"),
  jobs: () => request("/relay/jobs"),

  /**
   * Records buying the gift: get a signed URL, PUT the receipt, tell the
   * server it landed. Split into three steps so a failure mid-way can be
   * retried from the queue without redoing the whole thing.
   */
  async submitPurchase(orderId, { blob, contentType, amountPaidUsdCents }) {
    const { uploadUrl, path } = await request(`/relay/orders/${orderId}/purchase`, {
      method: "POST", body: { contentType },
    });
    await uploadToSignedUrl(uploadUrl, blob, contentType);
    return request(`/relay/orders/${orderId}/purchase`, {
      method: "POST", body: { path, complete: true, amountPaidUsdCents },
    });
  },

  async submitDelivery(orderId, { blob, contentType, recipientMessage, recipientConsent }) {
    const { uploadUrl, path } = await request(`/relay/orders/${orderId}/deliver`, {
      method: "POST", body: { contentType },
    });
    await uploadToSignedUrl(uploadUrl, blob, contentType);
    return request(`/relay/orders/${orderId}/deliver`, {
      method: "POST", body: { path, complete: true, recipientMessage, recipientConsent },
    });
  },
};

/** Sends one queued item. Used by flushQueue. */
export function sendQueuedItem(item) {
  if (item.kind === "purchase") {
    return relayApi.submitPurchase(item.orderId, {
      blob: item.blob,
      contentType: item.contentType,
      amountPaidUsdCents: item.amountPaidUsdCents,
    });
  }
  return relayApi.submitDelivery(item.orderId, {
    blob: item.blob,
    contentType: item.contentType,
    recipientMessage: item.recipientMessage,
    // Carried through the offline queue — consent was given at capture time,
    // and the server still requires it when the queued item finally sends.
    recipientConsent: item.recipientConsent,
  });
}
