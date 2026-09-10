// Firebase client SDK — modular npm package, replacing the CDN compat scripts.
//
// These values are public by design (Firebase web keys identify the project,
// they do not authorise anything). Access is controlled by firestore.rules and
// storage.rules. Anything actually secret lives server-side in api/.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB_dkil69qCnrs5bHXNo4_cnk6_LzjePWk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "amelior8-3dfef.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "amelior8-3dfef",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "amelior8-3dfef.firebasestorage.app",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:514297256936:web:db93d725d48de21f1c625d",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "514297256936",
};

export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Local development against the Firebase emulators. Never on in production —
// the flag is build-time and absent from any deployed environment.
if (import.meta.env.VITE_USE_EMULATOR === "1") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
