import { FieldValue, adminDb } from "../../_lib/admin.js";
import { requireOps } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { createInvite } from "../../_lib/invites.js";
import { ORG_ROLE } from "../../../shared/roles.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

/**
 * Ops onboards a partner organisation and invites its first admin. That admin
 * then invites their own colleagues, so Amelior8 never provisions individual
 * org staff.
 *
 * registrationNumber stays null unless a real one is supplied — a
 * plausible-looking charity number in a live database is worse than a missing
 * one.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  const ops = await requireOps(req);

  const db = adminDb();

  if (req.method === "GET") {
    const snap = await db.collection("partners").get();
    return json(res, 200, {
      orgs: snap.docs.map((d) => {
        const p = d.data();
        return {
          partnerId: d.id,
          name: p.name,
          countryCode: p.countryCode,
          location: p.location || null,
          verified: !!p.verified,
          active: p.active !== false,
          registrationNumber: p.registrationNumber || null,
          createdAt: iso(p.createdAt),
        };
      }),
    });
  }

  const {
    partnerId, name, countryCode, location = null,
    registrationNumber = null, adminEmail,
  } = readJsonBody(req);

  const id = String(partnerId || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(id)) {
    throw new HttpError(400, "partnerId must be 3-50 lowercase letters, numbers or hyphens.", "bad_partner_id");
  }
  if (!name?.trim()) throw new HttpError(400, "name is required.", "missing_name");
  if (!/^[A-Z]{2}$/.test(countryCode || "")) {
    throw new HttpError(400, "countryCode must be a two-letter code.", "bad_country");
  }
  if (!adminEmail) throw new HttpError(400, "adminEmail is required.", "missing_admin_email");

  const ref = db.collection("partners").doc(id);
  if ((await ref.get()).exists) {
    throw new HttpError(409, "An organisation with that id already exists.", "org_exists");
  }

  await ref.set({
    partnerId: id,
    name: name.trim(),
    countryCode,
    location: location?.trim() || null,
    registrationNumber: registrationNumber?.trim() || null,
    charityOfRecord: true,
    verified: false,
    active: true,
    createdBy: ops.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  const invite = await createInvite({
    partnerId: id,
    email: adminEmail,
    role: ORG_ROLE.ADMIN,
    invitedBy: ops.uid,
    invitedByLabel: "Amelior8 ops",
  });

  json(res, 201, {
    org: { partnerId: id, name: name.trim(), countryCode },
    invite: { email: invite.email, url: invite.url, expiresAt: invite.expiresAt },
  });
});
