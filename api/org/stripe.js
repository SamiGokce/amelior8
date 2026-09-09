import { requireOrg } from "../_lib/auth.js";
import { json, methodGuard, withErrors } from "../_lib/http.js";
import { getPartner, onboardingSummary, startOnboarding, syncAccountStatus } from "../_lib/connect.js";

/**
 * The org's own Stripe Connect state.
 *
 * GET  current status, re-synced from Stripe so a partner returning from
 *      onboarding sees the truth without waiting for the webhook.
 * POST mints a fresh onboarding link and returns it.
 *
 * partnerId comes from the verified token, so an org can only ever onboard
 * itself.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  const org = await requireOrg(req, { adminOnly: true });

  const base = process.env.APP_BASE_URL || `https://${req.headers.host}`;

  if (req.method === "GET") {
    const partner = await getPartner(org.partnerId);
    if (partner.stripeAccountId) {
      // Cheap enough to do on load, and avoids showing stale "incomplete".
      try {
        await syncAccountStatus(org.partnerId);
      } catch (err) {
        console.error(`Could not sync Connect status for ${org.partnerId}:`, err.message);
      }
    }
    const fresh = await getPartner(org.partnerId);
    return json(res, 200, { stripe: onboardingSummary(fresh) });
  }

  const { url, expiresAt } = await startOnboarding(org.partnerId, {
    returnUrl: `${base}/org?stripe=return`,
    refreshUrl: `${base}/org?stripe=refresh`,
  });

  json(res, 201, { url, expiresAt });
});
