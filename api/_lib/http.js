// Small helpers so every route answers in the same shape.

export function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

export function methodGuard(req, res, allowed) {
  const methods = Array.isArray(allowed) ? allowed : [allowed];
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  json(res, 405, { error: `Method ${req.method} not allowed`, code: "method_not_allowed" });
  return false;
}

/** Wraps a handler so an unexpected throw is logged server-side and never
 *  leaks a stack trace or a config detail to the caller. */
export function withErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[${req.method} ${req.url}]`, err);
      if (res.headersSent) return;
      const status = err?.statusCode || err?.status || 500;
      json(res, status, {
        error: status < 500 ? err.message : "Something went wrong.",
        code: err?.code || "internal_error",
      });
    }
  };
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.statusCode = status;
    this.code = code || "error";
  }
}

/** Vercel parses JSON bodies already, but a raw-body route (the Stripe webhook)
 *  turns that off — so tolerate both. */
export function readJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}
