import { router } from "../_handlers/_router.js";

import me from "../_handlers/org/me.js";
import invites from "../_handlers/org/invites.js";
import stripeStatus from "../_handlers/org/stripe.js";
import payouts from "../_handlers/org/payouts.js";
import relaysIndex from "../_handlers/org/relays/index.js";
import relayOne from "../_handlers/org/relays/[id].js";
import ordersIndex from "../_handlers/org/orders/index.js";
import orderAssign from "../_handlers/org/orders/[id]/assign.js";
import orderReview from "../_handlers/org/orders/[id]/review.js";

// One Serverless Function for every /api/org/* route. See _handlers/_router.js.
export default router("/api/org", [
  { pattern: "/me", handler: me },
  { pattern: "/invites", handler: invites },
  { pattern: "/stripe", handler: stripeStatus },
  { pattern: "/payouts", handler: payouts },
  { pattern: "/relays", handler: relaysIndex },
  { pattern: "/relays/:id", handler: relayOne },
  { pattern: "/orders", handler: ordersIndex },
  { pattern: "/orders/:id/assign", handler: orderAssign },
  { pattern: "/orders/:id/review", handler: orderReview },
]);
