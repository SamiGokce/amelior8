import { adminDb } from "../../../_lib/admin.js";
import { requireOps } from "../../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder, transitionOrder } from "../../../_lib/orderState.js";
import { sendOrderEmail } from "../../../_lib/email.js";
import { STATUS } from "../../../../shared/orderStatus.js";

/**
 * Assigns a GR8 to a funded gift. FUNDED -> ASSIGNED.
 *
 * The GR8 app will eventually do this itself (accepting a job); it calls the
 * same transitionOrder underneath, so no donor-side code changes when it does.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const ops = await requireOps(req);

  const orderId = req.query.id;
  const { facilitatorId } = readJsonBody(req);
  if (!facilitatorId) throw new HttpError(400, "facilitatorId is required.", "missing_facilitator");

  const facSnap = await adminDb().collection("facilitators").doc(facilitatorId).get();
  if (!facSnap.exists) throw new HttpError(404, "No such facilitator.", "facilitator_not_found");
  const facilitator = facSnap.data();
  if (facilitator.active === false) {
    throw new HttpError(409, "That facilitator is not active.", "facilitator_inactive");
  }

  const order = await getOrder(orderId);
  if (facilitator.countryCode !== order.countryCode) {
    throw new HttpError(
      409,
      `That GR8 works in ${facilitator.countryCode}, but this gift is for ${order.countryCode}.`,
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
      note: `Assigned to ${facilitator.name}.`,
      patch: {
        facilitatorId,
        // Denormalised so the donor's tracking screen never reads the
        // facilitators collection, which stays server-only.
        facilitatorSnapshot: {
          name: facilitator.name,
          photoUrl: facilitator.photoUrl || null,
        },
        estimatedDeliveryAt,
      },
    },
  );

  if (changed) await sendOrderEmail(STATUS.ASSIGNED, { ...order, ...updated, id: orderId });

  json(res, 200, { orderId, status: STATUS.ASSIGNED, changed, facilitator: facilitator.name });
});
