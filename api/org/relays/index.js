import { FieldValue, adminAuth, adminDb } from "../../_lib/admin.js";
import { requireOrg } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { relayEmail, validatePin, validateUsername } from "../../../shared/roles.js";
import { STATUS } from "../../../shared/orderStatus.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

const OPEN = [STATUS.ASSIGNED, STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED];

/**
 * The org's relay roster.
 *
 * GET  lists their relays with what each one is currently holding.
 * POST creates one: a Firebase Auth account under a synthesized address, with
 *      the PIN as its credential and `role: "relay"` custom claims. Only an org
 *      admin can add people.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST"])) return;

  if (req.method === "GET") {
    const org = await requireOrg(req);
    const db = adminDb();

    const [relaySnap, orderSnap] = await Promise.all([
      db.collection("relays").where("partnerId", "==", org.partnerId).get(),
      db.collection("orders")
        .where("partnerId", "==", org.partnerId)
        .where("status", "in", OPEN)
        .get(),
    ]);

    const openByRelay = {};
    const doneByRelay = {};
    orderSnap.docs.forEach((d) => {
      const o = d.data();
      if (!o.relayId) return;
      (openByRelay[o.relayId] ||= []).push({
        id: d.id,
        item: o.itemSnapshot?.name || null,
        status: o.status,
        recipient: o.recipient?.firstName || null,
      });
    });

    const relays = relaySnap.docs.map((d) => {
      const r = d.data();
      return {
        id: d.id,
        name: r.name,
        username: r.username,
        photoUrl: r.photoUrl || null,
        phone: r.phone || null,
        active: r.active !== false,
        createdAt: iso(r.createdAt),
        pinSetAt: iso(r.pinSetAt),
        completedDeliveries: r.completedDeliveries || 0,
        assigned: openByRelay[d.id] || [],
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return json(res, 200, { relays });
  }

  // ---- create -------------------------------------------------------------
  const org = await requireOrg(req, { adminOnly: true });
  const { name, username, pin, phone = null, photoUrl = null } = readJsonBody(req);

  const cleanName = String(name || "").trim().slice(0, 80);
  if (!cleanName) throw new HttpError(400, "A name is required.", "missing_name");

  const u = validateUsername(username);
  if (!u.ok) throw new HttpError(400, u.error, "bad_username");

  const p = validatePin(pin);
  if (!p.ok) throw new HttpError(400, p.error, "bad_pin");

  const db = adminDb();
  const relayRef = db.collection("relays").doc();

  // Usernames are global because they map to a Firebase account. Claim it
  // before creating anything, so two orgs cannot race for the same one.
  const claim = db.collection("relayUsernames").doc(u.value);
  try {
    await claim.create({ relayId: relayRef.id, partnerId: org.partnerId, createdAt: FieldValue.serverTimestamp() });
  } catch {
    throw new HttpError(409, "That username is already taken.", "username_taken");
  }

  let authUser;
  try {
    authUser = await adminAuth().createUser({
      uid: `relay_${relayRef.id}`,
      email: relayEmail(u.value),
      emailVerified: false,
      password: p.value,
      displayName: cleanName,
    });
    await adminAuth().setCustomUserClaims(authUser.uid, {
      role: "relay",
      relayId: relayRef.id,
      partnerId: org.partnerId,
    });
  } catch (err) {
    await claim.delete().catch(() => {});
    if (err?.code === "auth/email-already-exists") {
      throw new HttpError(409, "That username is already taken.", "username_taken");
    }
    throw err;
  }

  await relayRef.set({
    relayId: relayRef.id,
    partnerId: org.partnerId,
    name: cleanName,
    username: u.value,
    phone: phone ? String(phone).trim().slice(0, 32) : null,
    photoUrl,
    authUid: authUser.uid,
    active: true,
    completedDeliveries: 0,
    createdBy: org.uid,
    createdAt: FieldValue.serverTimestamp(),
    pinSetAt: FieldValue.serverTimestamp(),
  });

  // The PIN is never stored or returned — it exists only as the Firebase
  // credential. If it is lost, an admin sets a new one.
  json(res, 201, {
    relay: { id: relayRef.id, name: cleanName, username: u.value, active: true },
  });
});
