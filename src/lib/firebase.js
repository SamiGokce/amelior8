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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB8r_o3Vgxnu6ClOZ52RVoTnP7OyVAL37s",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "amelior8it.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "amelior8it",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "amelior8it.firebasestorage.app",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
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
