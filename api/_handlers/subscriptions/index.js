import { adminDb } from "../../_lib/admin.js";
import { requireUser } from "../../_lib/auth.js";
import { json, methodGuard, withErrors } from "../../_lib/http.js";

/**
 * The donor's own recurring gifts.
 *
 * Served here rather than by a Firestore listener because the security rules
 * keep `subscriptions` server-only. The order template is stripped — it is
 * internal bookkeeping, not something the client needs.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;

  const user = await requireUser(req);
  const snap = await adminDb()
    .collection("subscriptions")
    .where("donorUid", "==", user.uid)
    .get();

  const subscriptions = snap.docs.map((d) => {
    const { orderTemplate, ...rest } = d.data();
    return {
      id: d.id,
      ...rest,
      createdAt: rest.createdAt?.toDate?.()?.toISOString() || null,
      cancelledAt: rest.cancelledAt?.toDate?.()?.toISOString() || null,
      lastChargedAt: rest.lastChargedAt?.toDate?.()?.toISOString() || null,
    };
  });

  json(res, 200, { subscriptions });
});
