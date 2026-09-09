import { adminDb } from "../../../_lib/admin.js";
import { requireOps } from "../../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder, transitionOrder } from "../../../_lib/orderState.js";
import { sendOrderEmail } from "../../../_lib/email.js";
import { STATUS } from "../../../../shared/orderStatus.js";

/**
 * Assigns a relay to a funded gift. FUNDED -> ASSIGNED.
 *
 * The relay app will eventually do this itself (accepting a job); it calls the
 * same transitionOrder underneath, so no donor-side code changes when it does.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const ops = await requireOps(req);

  const orderId = req.query.id;
  const { relayId } = readJsonBody(req);
  if (!relayId) throw new HttpError(400, "relayId is required.", "missing_relay");

  const facSnap = await adminDb().collection("relays").doc(relayId).get();
  if (!facSnap.exists) throw new HttpError(404, "No such relay.", "relay_not_found");
  const relay = facSnap.data();
  if (relay.active === false) {
    throw new HttpError(409, "That relay is not active.", "relay_inactive");
  }

  const order = await getOrder(orderId);
  if (relay.countryCode !== order.countryCode) {
    throw new HttpError(
      409,
      `That relay works in ${relay.countryCode}, but this gift is for ${order.countryCode}.`,
      "country_mismatch",
    );
  }

  // Estimated delivery is set at assignment, from the item's own lead time.
  const days = order.itemSnapshot?.estimatedDeliveryDays || 7;
  const estimatedDeliveryAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const { changed, order: updated } = await transitionOrder(
    orderId,
    STATUS.ASSIGNED,
    { kind: "ops", id: ops.uid },
    {
      note: `Assigned to ${relay.name}.`,
      patch: {
        relayId,
        // Denormalised so the donor's tracking screen never reads the
        // relays collection, which stays server-only.
        relaySnapshot: {
          name: relay.name,
          photoUrl: relay.photoUrl || null,
        },
        estimatedDeliveryAt,
      },
    },
  );

  if (changed) await sendOrderEmail(STATUS.ASSIGNED, { ...order, ...updated, id: orderId });

  json(res, 200, { orderId, status: STATUS.ASSIGNED, changed, relay: relay.name });
});
