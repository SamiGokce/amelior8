import { auth } from "./firebase";

// Dev-only: the ?preview=1 fixture mode has no real session, so the signed-in
// check is skipped. Statically false in a production build.
const PREVIEW = import.meta.env.DEV
  && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("preview") === "1";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
  /** Worth retrying later — the request never reached a decision. */
  get isTransient() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

/**
 * One authed fetch for all three front ends.
 *
 * Every call carries the caller's Firebase ID token; the server decides what
 * they may do from the claims in it, never from anything sent in the body.
 */
export async function request(path, { method = "GET", body, authed = true, signal } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (authed && !PREVIEW) {
    const user = auth.currentUser;
    if (!user) throw new ApiError("You need to be signed in.", 401, "unauthenticated");
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // No response at all — offline, DNS, connection dropped mid-flight.
    if (err?.name === "AbortError") throw err;
    throw new ApiError("No connection. Check your network and try again.", 0, "offline");
  }

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response (a proxy error page, say) — surface the status instead.
  }

  if (!res.ok) {
    throw new ApiError(
      payload?.error || `Request failed (${res.status})`,
      res.status,
      payload?.code || "unknown",
    );
  }

  return payload;
}

/**
 * PUTs bytes straight to a signed Storage URL.
 *
 * Deliberately not through /api — the file never passes through a serverless
 * function, which is what keeps large photos on bad connections workable.
 */
export async function uploadToSignedUrl(uploadUrl, blob, contentType) {
  let res;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
  } catch {
    throw new ApiError("Upload failed. Check your connection.", 0, "offline");
  }
  if (!res.ok) {
    throw new ApiError(`Upload failed (${res.status})`, res.status, "upload_failed");
  }
  return true;
}
