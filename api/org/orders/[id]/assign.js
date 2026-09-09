import { adminDb } from "../../../_lib/admin.js";
import { assertOrderBelongsToOrg, requireOrg } from "../../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder, transitionOrder } from "../../../_lib/orderState.js";
import { sendOrderEmail } from "../../../_lib/email.js";
import { STATUS } from "../../../../shared/orderStatus.js";

/**
 * The org assigns one of its own relays to a funded gift, and records who the
 * gift is for. FUNDED -> ASSIGNED.
 *
 * Recipient data is deliberately minimal: a first name and a general area.
 * Enough for the relay to do the job and for the donor to see where it went,
 * without building a register of vulnerable people.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["POST", "PATCH"])) return;
  const org = await requireOrg(req);

  const orderId = req.query.id;
  const { relayId, recipient } = readJsonBody(req);

  if (!relayId) throw new HttpError(400, "relayId is required.", "missing_relay");

  const order = await getOrder(orderId);
  assertOrderBelongsToOrg(order, org.partnerId);

  const relaySnap = await adminDb().collection("relays").doc(relayId).get();
  if (!relaySnap.exists) throw new HttpError(404, "No such relay.", "relay_not_found");
  const relay = relaySnap.data();

  // A relay belongs to exactly one org, and only that org can dispatch them.
  if (relay.partnerId !== org.partnerId) {
    throw new HttpError(404, "No such relay.", "relay_not_found");
  }
  if (relay.active === false) {
    throw new HttpError(409, `${relay.name} is not active.`, "relay_inactive");
  }

  const firstName = String(recipient?.firstName || "").trim().slice(0, 60);
  const area = String(recipient?.area || "").trim().slice(0, 80);
  if (!firstName) {
    throw new HttpError(400, "A recipient first name is required.", "missing_recipient");
  }

  // Reassigning an already-assigned gift is a patch, not a new transition.
  const isReassign = order.status !== STATUS.FUNDED;
  if (isReassign && ![STATUS.ASSIGNED, STATUS.PURCHASED].includes(order.status)) {
    throw new HttpError(
      409,
      `A gift that is ${order.status} cannot be reassigned.`,
      "not_assignable",
    );
  }

  const days = order.itemSnapshot?.estimatedDeliveryDays || 7;
  const patch = {
    relayId,
    // Denormalised so the donor's tracking screen never reads the relays
    // collection, which stays server-only.
    relaySnapshot: { name: relay.name, photoUrl: relay.photoUrl || null },
    recipient: { firstName, area: area || null },
    estimatedDeliveryAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  };

  if (isReassign) {
    await adminDb().collection("orders").doc(orderId).update(patch);
    await import("../../../_lib/orderState.js").then(({ recordEvent }) =>
      recordEvent(orderId, "relay_reassigned", org.actor, { relayId, relayName: relay.name }),
    );
    return json(res, 200, { orderId, status: order.status, relay: relay.name, reassigned: true });
  }

  const { changed, order: updated } = await transitionOrder(
    orderId,
    STATUS.ASSIGNED,
    org.actor,
    { note: `Assigned to ${relay.name}.`, patch },
  );

  if (changed) await sendOrderEmail(STATUS.ASSIGNED, { ...order, ...updated, id: orderId });

  json(res, 200, { orderId, status: STATUS.ASSIGNED, changed, relay: relay.name });
});
