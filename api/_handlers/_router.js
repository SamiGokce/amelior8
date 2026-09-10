import { json } from "../_lib/http.js";

/**
 * Shared dispatch for a domain's catch-all route.
 *
 * Vercel counts one Serverless Function per top-level file under `api/` (files
 * under an `_`-prefixed folder don't count, same trick already used for
 * `_lib`). The Hobby plan caps at 12, and this project's real route count is
 * well past that one-file-per-route — so each domain (org, relay, ops, and the
 * misc top-level routes) is ONE function dispatching to the original handler
 * modules, which are unchanged apart from their location.
 *
 * Path resolution reads `req.url` rather than `req.query.path`. Vercel's
 * dynamic-segment population for `[...path]` catch-alls did NOT happen in this
 * project's runtime — every request arrived with an empty `req.query.path`, so
 * every router fell through to its own 404 and the entire API was dead in
 * production. `req.url` is always present and unambiguous, so the router owns
 * its own parsing instead of depending on platform behaviour.
 *
 * `routes` maps a method + path pattern to a handler. A segment written `:id`
 * captures that segment onto `req.query.id` before the handler runs — matching
 * what each handler already expects from when it was its own `[id].js` file.
 */
export function router(basePath, routes) {
  return async (req, res) => {
    const segments = resolveSegments(req, basePath);
    const path = "/" + segments.join("/");

    for (const route of routes) {
      if (route.method && route.method !== req.method) continue;
      const match = matchPattern(route.pattern, segments);
      if (!match) continue;
      req.query = { ...(req.query || {}), ...match.params };
      return route.handler(req, res);
    }

    json(res, 404, { error: `No route for ${req.method} ${path}`, code: "not_found" });
  };
}

/**
 * The path segments after `basePath`, e.g. `/api/org/orders/abc/assign` with a
 * base of `/api/org` gives ["orders", "abc", "assign"].
 */
function resolveSegments(req, basePath) {
  // Preferred: parse the real request URL.
  const raw = req.url || "";
  if (raw) {
    // req.url may be path-only or absolute; the dummy origin handles both.
    const pathname = new URL(raw, "http://internal").pathname;
    if (pathname.startsWith(basePath)) {
      return pathname.slice(basePath.length).split("/").filter(Boolean);
    }
    // The base may already have been stripped by a rewrite.
    const stripped = pathname.replace(/^\/api\/?/, "");
    if (stripped) return stripped.split("/").filter(Boolean);
  }

  // Fallback: whatever the platform did populate. Also what the local tests use.
  const q = req.query?.path;
  if (Array.isArray(q)) return q.filter(Boolean);
  if (typeof q === "string" && q) return q.split("/").filter(Boolean);
  return [];
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
