import { adminDb } from "../../_lib/admin.js";
import { requireOrg } from "../../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { createInvite } from "../../_lib/invites.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

/**
 * An org admin invites a colleague into their own organisation.
 *
 * partnerId comes from the verified token, so an admin can only ever invite
 * someone into their own org — never another.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  const org = await requireOrg(req, { adminOnly: true });

  if (req.method === "GET") {
    const [invites, users] = await Promise.all([
      adminDb().collection("orgInvites").where("partnerId", "==", org.partnerId).get(),
      adminDb().collection("orgUsers").where("partnerId", "==", org.partnerId).get(),
    ]);

    return json(res, 200, {
      // Tokens are stored hashed and never returned — a pending invite can be
      // re-sent, not re-read.
      invites: invites.docs
        .map((d) => d.data())
        .filter((i) => !i.acceptedAt)
        .map((i) => ({ email: i.email, role: i.role, expiresAt: iso(i.expiresAt) })),
      members: users.docs.map((d) => {
        const u = d.data();
        return { uid: u.uid, email: u.email, name: u.name, role: u.role, active: u.active !== false };
      }),
    });
  }

  const { email, role = "org_staff" } = readJsonBody(req);
  const invite = await createInvite({
    partnerId: org.partnerId,
    email,
    role,
    invitedBy: org.uid,
    invitedByLabel: org.email,
  });

  // The link is returned once for the admin to pass on. No invite email is
  // wired yet, so handing it over is deliberate and manual.
  json(res, 201, { email: invite.email, role: invite.role, url: invite.url, expiresAt: invite.expiresAt });
});
