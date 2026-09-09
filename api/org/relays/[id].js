import { FieldValue, adminAuth, adminDb } from "../../_lib/admin.js";
import { requireOrg } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { validatePin } from "../../../shared/roles.js";
import { STATUS } from "../../../shared/orderStatus.js";

const OPEN = [STATUS.ASSIGNED, STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED];

/**
 * Edit one relay: rename, set a new PIN, or deactivate.
 *
 * Deactivating disables the Firebase account so they cannot sign in, but the
 * relay record and their delivery history stay — orders reference them, and
 * those are financial records. A relay still holding open gifts cannot be
 * deactivated until those are reassigned.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["PATCH", "DELETE"])) return;
  const org = await requireOrg(req, { adminOnly: true });

  const relayId = req.query.id;
  const db = adminDb();
  const ref = db.collection("relays").doc(relayId);
  const snap = await ref.get();

  // Same 404 for "does not exist" and "belongs to another org".
  if (!snap.exists || snap.data().partnerId !== org.partnerId) {
    throw new HttpError(404, "No such relay.", "relay_not_found");
  }
  const relay = snap.data();

  const body = req.method === "DELETE" ? { active: false } : readJsonBody(req);
  const { name, pin, phone, photoUrl, active } = body;
  const patch = { updatedAt: FieldValue.serverTimestamp() };

  if (name !== undefined) {
    const clean = String(name).trim().slice(0, 80);
    if (!clean) throw new HttpError(400, "A name is required.", "missing_name");
    patch.name = clean;
    await adminAuth().updateUser(relay.authUid, { displayName: clean });
  }

  if (phone !== undefined) patch.phone = phone ? String(phone).trim().slice(0, 32) : null;
  if (photoUrl !== undefined) patch.photoUrl = photoUrl || null;

  if (pin !== undefined) {
    const p = validatePin(pin);
    if (!p.ok) throw new HttpError(400, p.error, "bad_pin");
    await adminAuth().updateUser(relay.authUid, { password: p.value });
    // Existing sessions die with the old PIN — the point of resetting it.
    await adminAuth().revokeRefreshTokens(relay.authUid);
    patch.pinSetAt = FieldValue.serverTimestamp();
  }

  if (active !== undefined) {
    const makeActive = !!active;
    if (!makeActive) {
      const open = await db.collection("orders")
        .where("relayId", "==", relayId)
        .where("status", "in", OPEN)
        .limit(1)
        .get();
      if (!open.empty) {
        throw new HttpError(
          409,
          `${relay.name} still has gifts in progress. Reassign them first.`,
          "relay_has_open_work",
        );
      }
    }
    patch.active = makeActive;
    await adminAuth().updateUser(relay.authUid, { disabled: !makeActive });
    if (!makeActive) await adminAuth().revokeRefreshTokens(relay.authUid);
  }

  await ref.update(patch);
  json(res, 200, { relayId, updated: Object.keys(patch).filter((k) => k !== "updatedAt") });
});
