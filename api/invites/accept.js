import { requireUser } from "../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../_lib/http.js";
import { acceptInvite } from "../_lib/invites.js";

/**
 * Redeems an org invite for the signed-in user.
 *
 * Authenticated but role-less by design: this is exactly how someone gets
 * their first role. acceptInvite() checks the token, the expiry, and that the
 * signed-in address matches the one invited.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;

  const user = await requireUser(req);
  const { token } = readJsonBody(req);
  const result = await acceptInvite(token, user);

  json(res, 200, {
    ...result,
    // The client must force a token refresh before the new claims are visible.
    refreshTokenRequired: true,
  });
});
