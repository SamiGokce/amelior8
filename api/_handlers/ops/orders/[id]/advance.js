import { requireOps } from "../../../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../../../_lib/http.js";
import { getOrder, transitionOrder } from "../../../../_lib/orderState.js";
import { sendOrderEmail } from "../../../../_lib/email.js";
import { STATUS } from "../../../../../shared/orderStatus.js";

// Statuses ops may set by hand. FUNDED is not here — only a cleared payment
// funds an order. VERIFIED is not here either — that is the review endpoint's
// job, so a badge can never be granted by a stray button.
const OPS_SETTABLE = [
  STATUS.PURCHASED,
  STATUS.ON_HOLD,
  STATUS.CANCELLED,
  STATUS.ASSIGNED,
];

/** Validated status move. Refuses anything the state machine disallows. */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const ops = await requireOps(req);

  const orderId = req.query.id;
  const { toStatus, note = null } = readJsonBody(req);

  if (!toStatus) throw new HttpError(400, "toStatus is required.", "missing_status");
  if (!OPS_SETTABLE.includes(toStatus)) {
    throw new HttpError(
      400,
      `Ops cannot set ${toStatus} directly. Allowed: ${OPS_SETTABLE.join(", ")}.`,
      "status_not_settable",
    );
  }

  const before = await getOrder(orderId);
  const { changed, order, fromStatus } = await transitionOrder(
    orderId,
    toStatus,
    { kind: "ops", id: ops.uid },
    { note },
  );

  if (changed && toStatus === STATUS.PURCHASED) {
    await sendOrderEmail(STATUS.PURCHASED, { ...before, ...order, id: orderId });
  }

  json(res, 200, { orderId, fromStatus, status: toStatus, changed });
});
