import { adminDb } from "../../_lib/admin.js";
import { requireRelay } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, withErrors } from "../../_lib/http.js";

/**
 * Who the signed-in relay is and which organisation they work for.
 *
 * A relay deactivated by their org still holds a valid token until it expires,
 * so this checks the record too and tells the app to sign them out.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;
  const relay = await requireRelay(req);

  const [relaySnap, partnerSnap] = await Promise.all([
    adminDb().collection("relays").doc(relay.relayId).get(),
    adminDb().collection("partners").doc(relay.partnerId).get(),
  ]);

  if (!relaySnap.exists) throw new HttpError(403, "This account no longer exists.", "relay_not_found");
  const record = relaySnap.data();
  if (record.active === false) {
    throw new HttpError(403, "This account has been deactivated.", "relay_inactive");
  }

  json(res, 200, {
    relay: {
      relayId: relay.relayId,
      name: record.name,
      username: record.username,
      photoUrl: record.photoUrl || null,
      completedDeliveries: record.completedDeliveries || 0,
    },
    org: {
      partnerId: relay.partnerId,
      name: partnerSnap.exists ? partnerSnap.data().name : "Your organisation",
      location: partnerSnap.exists ? partnerSnap.data().location || null : null,
    },
  });
});
