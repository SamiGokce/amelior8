import { router } from "./_handlers/_router.js";

// Org
import orgMe from "./_handlers/org/me.js";
import orgInvites from "./_handlers/org/invites.js";
import orgStripe from "./_handlers/org/stripe.js";
import orgPayouts from "./_handlers/org/payouts.js";
import orgRelaysIndex from "./_handlers/org/relays/index.js";
import orgRelayOne from "./_handlers/org/relays/[id].js";
import orgOrdersIndex from "./_handlers/org/orders/index.js";
import orgOrderAssign from "./_handlers/org/orders/[id]/assign.js";
import orgOrderReview from "./_handlers/org/orders/[id]/review.js";

// Relay
import relayMe from "./_handlers/relay/me.js";
import relayJobs from "./_handlers/relay/jobs.js";
import relayPurchase from "./_handlers/relay/orders/[id]/purchase.js";
import relayDeliver from "./_handlers/relay/orders/[id]/deliver.js";

// Ops
import opsOrgs from "./_handlers/ops/orgs.js";
import opsPayouts from "./_handlers/ops/payouts.js";
import opsOrdersIndex from "./_handlers/ops/orders/index.js";
import opsOrderAssign from "./_handlers/ops/orders/[id]/assign.js";
import opsOrderAdvance from "./_handlers/ops/orders/[id]/advance.js";
import opsOrderProofUpload from "./_handlers/ops/orders/[id]/proof-upload-url.js";
import opsProofReview from "./_handlers/ops/proofs/[id]/review.js";

// Donor / misc
import checkoutSession from "./_handlers/checkout/session.js";
import subscriptionsIndex from "./_handlers/subscriptions/index.js";
import subscriptionsCancel from "./_handlers/subscriptions/cancel.js";
import invitesAccept from "./_handlers/invites/accept.js";
import donorProofUploadUrl from "./_handlers/orders/[id]/proof-upload-url.js";
import donorProofUrl from "./_handlers/orders/[id]/proof-url.js";

/**
 * Single Serverless Function for the entire /api/* surface.
 *
 * Previously split into one catch-all per domain (api/org/[...path].js,
 * api/relay/[...path].js, api/ops/[...path].js, plus this root one) — four
 * functions, comfortably under the Hobby plan's 12-function cap. In
 * production, every route requiring 2+ path segments under ANY of those
 * nested catch-alls returned Vercel's own platform 404, never reaching this
 * code at all, while single-segment routes worked. Single-segment routes are
 * exactly the ones with no ambiguity between a nested catch-all (api/org/
 * [...path].js matching ["me"]) and this root one (matching ["org","me"]);
 * every multi-segment route is ambiguous between them. Collapsing to one
 * unambiguous catch-all removes that entirely, and still leaves four routers
 * (see the "org"/"relay"/"ops" prefixes below) well within the function cap
 * as a single function. See _handlers/_router.js for the request-URL parsing
 * that replaced the equally-unreliable req.query.path assumption.
 */
export default router("/api", [
  { pattern: "/org/me", handler: orgMe },
  { pattern: "/org/invites", handler: orgInvites },
  { pattern: "/org/stripe", handler: orgStripe },
  { pattern: "/org/payouts", handler: orgPayouts },
  { pattern: "/org/relays", handler: orgRelaysIndex },
  { pattern: "/org/relays/:id", handler: orgRelayOne },
  { pattern: "/org/orders", handler: orgOrdersIndex },
  { pattern: "/org/orders/:id/assign", handler: orgOrderAssign },
  { pattern: "/org/orders/:id/review", handler: orgOrderReview },

  { pattern: "/relay/me", handler: relayMe },
  { pattern: "/relay/jobs", handler: relayJobs },
  { pattern: "/relay/orders/:id/purchase", handler: relayPurchase },
  { pattern: "/relay/orders/:id/deliver", handler: relayDeliver },

  { pattern: "/ops/orgs", handler: opsOrgs },
  { pattern: "/ops/payouts", handler: opsPayouts },
  { pattern: "/ops/orders", handler: opsOrdersIndex },
  { pattern: "/ops/orders/:id/assign", handler: opsOrderAssign },
  { pattern: "/ops/orders/:id/advance", handler: opsOrderAdvance },
  { pattern: "/ops/orders/:id/proof-upload-url", handler: opsOrderProofUpload },
  { pattern: "/ops/proofs/:id/review", handler: opsProofReview },

  { pattern: "/checkout/session", handler: checkoutSession },
  { pattern: "/subscriptions", handler: subscriptionsIndex },
  { pattern: "/subscriptions/cancel", handler: subscriptionsCancel },
  { pattern: "/invites/accept", handler: invitesAccept },
  { pattern: "/orders/:id/proof-upload-url", handler: donorProofUploadUrl },
  { pattern: "/orders/:id/proof-url", handler: donorProofUrl },
]);
