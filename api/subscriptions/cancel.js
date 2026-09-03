import { FieldValue, adminDb } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../_lib/http.js";
import { stripe } from "../_lib/stripe.js";

/** Cancels a recurring gift. Stops future orders; leaves past ones alone. */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;

  const user = await requireUser(req);
  const { subscriptionId } = readJsonBody(req);
  if (!subscriptionId) throw new HttpError(400, "subscriptionId is required.", "missing_subscription");

  const ref = adminDb().collection("subscriptions").doc(subscriptionId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Subscription not found.", "not_found");
  // Same-shaped 404 rather than a 403, so this can't be used to probe ids.
  if (snap.data().donorUid !== user.uid) {
    throw new HttpError(404, "Subscription not found.", "not_found");
  }

  await stripe().subscriptions.cancel(subscriptionId);
  await ref.update({
    status: "cancelled",
    cancelledAt: FieldValue.serverTimestamp(),
  });

  json(res, 200, { subscriptionId, status: "cancelled" });
});
