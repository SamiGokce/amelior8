import { adminDb } from "../../_lib/admin.js";
import { requireOrg } from "../../_lib/auth.js";
import { json, methodGuard, withErrors } from "../../_lib/http.js";

/**
 * Who the signed-in org user is and which organisation they act for.
 * The portal calls this on load — the partnerId comes from the verified token,
 * never from anything the client supplies.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;
  const org = await requireOrg(req);

  const partnerSnap = await adminDb().collection("partners").doc(org.partnerId).get();
  const partner = partnerSnap.exists ? partnerSnap.data() : null;

  json(res, 200, {
    user: {
      uid: org.uid,
      email: org.email,
      name: org.name,
      role: org.orgRole,
      isAdmin: org.isAdmin,
    },
    org: partner
      ? {
          partnerId: org.partnerId,
          name: partner.name,
          location: partner.location || null,
          countryCode: partner.countryCode || null,
          active: partner.active !== false,
        }
      : { partnerId: org.partnerId, name: "Unknown organisation" },
  });
});
