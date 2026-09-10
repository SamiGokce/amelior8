import { router } from "../_handlers/_router.js";

import me from "../_handlers/relay/me.js";
import jobs from "../_handlers/relay/jobs.js";
import purchase from "../_handlers/relay/orders/[id]/purchase.js";
import deliver from "../_handlers/relay/orders/[id]/deliver.js";

// One Serverless Function for every /api/relay/* route. See _handlers/_router.js.
export default router("/api/relay", [
  { pattern: "/me", handler: me },
  { pattern: "/jobs", handler: jobs },
  { pattern: "/orders/:id/purchase", handler: purchase },
  { pattern: "/orders/:id/deliver", handler: deliver },
]);
