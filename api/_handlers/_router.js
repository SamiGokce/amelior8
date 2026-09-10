import { json } from "../_lib/http.js";

/**
 * Shared dispatch for a domain's catch-all route.
 *
 * Vercel counts one Serverless Function per top-level file under `api/`
 * (files under an `_`-prefixed folder don't count, same trick already used
 * for `_lib`). The Hobby plan caps at 12 functions, and this project's real
 * route count is well past that split one-file-per-route — so each domain
 * (org, relay, ops, and the misc top-level routes) is now ONE function that
 * dispatches to the original handler modules, which are unchanged apart from
 * their location.
 *
 * `routes` maps a method + path-pattern to a handler. A pattern segment
 * wrapped in `:` (e.g. `:id`) captures that segment and sets it onto
 * `req.query.id` before calling the handler — matching what each handler
 * already expects from when it was its own `[id].js` file.
 */
export function router(routes) {
  return async (req, res) => {
    // Vercel's catch-all gives req.query.path as an array of segments after
    // the domain prefix, e.g. /api/org/orders/abc/assign -> ["orders","abc","assign"].
    const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    const path = "/" + segments.join("/");

    for (const route of routes) {
      if (route.method && route.method !== req.method) continue;
      const match = matchPattern(route.pattern, segments);
      if (!match) continue;
      Object.assign(req.query, match.params);
      return route.handler(req, res);
    }

    json(res, 404, { error: `No route for ${req.method} ${path}`, code: "not_found" });
  };
}

function matchPattern(pattern, segments) {
  const parts = pattern.split("/").filter(Boolean);
  if (parts.length !== segments.length) return null;

  const params = {};
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith(":")) params[part.slice(1)] = segments[i];
    else if (part !== segments[i]) return null;
  }
  return { params };
}
