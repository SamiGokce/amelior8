import { router } from "../_handlers/_router.js";

import orgs from "../_handlers/ops/orgs.js";
import payouts from "../_handlers/ops/payouts.js";
import ordersIndex from "../_handlers/ops/orders/index.js";
import orderAssign from "../_handlers/ops/orders/[id]/assign.js";
import orderAdvance from "../_handlers/ops/orders/[id]/advance.js";
import orderProofUpload from "../_handlers/ops/orders/[id]/proof-upload-url.js";
import proofReview from "../_handlers/ops/proofs/[id]/review.js";

// One Serverless Function for every /api/ops/* route. See _handlers/_router.js.
export default router([
  { pattern: "/orgs", handler: orgs },
  { pattern: "/payouts", handler: payouts },
  { pattern: "/orders", handler: ordersIndex },
  { pattern: "/orders/:id/assign", handler: orderAssign },
  { pattern: "/orders/:id/advance", handler: orderAdvance },
  { pattern: "/orders/:id/proof-upload-url", handler: orderProofUpload },
  { pattern: "/proofs/:id/review", handler: proofReview },
]);
