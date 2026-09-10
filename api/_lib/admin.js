// Firebase Admin SDK. Server-only — this key bypasses every security rule, so
// it must never be imported from anything under src/.

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { localBucket } from "./localStorage.js";

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add the service account key to the Vercel environment.",
    );
  }
  // Accept both raw JSON and base64, since dashboards mangle newlines differently.
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return cert(JSON.parse(json));
}

let cached = null;

export function adminApp() {
  if (cached) return cached;
  cached = getApps().length
    ? getApp()
    : initializeApp({
        credential: credentials(),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "amelior8-3dfef.firebasestorage.app",
      });
  return cached;
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());

/**
 * Local-disk stand-in for Firebase Storage, used only when LOCAL_STORAGE_DIR
 * is set — which is never the case on Vercel. Firebase's own Storage emulator
 * doesn't support the V4 signed-URL scheme proof.js relies on (write actions
 * 501), and real Storage needs the Blaze plan. This lets the relay
 * purchase/deliver flow be tested end-to-end against a fully local stack
 * (see scripts/dev-api.mjs) before that billing decision is made.
 */
export const adminBucket = () =>
  process.env.LOCAL_STORAGE_DIR ? localBucket() : getStorage(adminApp()).bucket();

export { FieldValue };
