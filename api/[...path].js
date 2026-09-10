import { router } from "./_handlers/_router.js";

import checkoutSession from "./_handlers/checkout/session.js";
import subscriptionsIndex from "./_handlers/subscriptions/index.js";
import subscriptionsCancel from "./_handlers/subscriptions/cancel.js";
import invitesAccept from "./_handlers/invites/accept.js";
import proofUploadUrl from "./_handlers/orders/[id]/proof-upload-url.js";
import proofUrl from "./_handlers/orders/[id]/proof-url.js";

// One Serverless Function for the remaining top-level donor routes:
// checkout, subscriptions, invites, and the donor's own proof endpoints.
// /api/org/*, /api/relay/*, /api/ops/* and /api/webhooks/* each have their
// own file and take precedence over this catch-all for those prefixes.
export default router("/api", [
  { pattern: "/checkout/session", handler: checkoutSession },
  { pattern: "/subscriptions", handler: subscriptionsIndex },
  { pattern: "/subscriptions/cancel", handler: subscriptionsCancel },
  { pattern: "/invites/accept", handler: invitesAccept },
  { pattern: "/orders/:id/proof-upload-url", handler: proofUploadUrl },
  { pattern: "/orders/:id/proof-url", handler: proofUrl },
]);
