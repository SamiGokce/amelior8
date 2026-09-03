// Firebase client SDK — modular npm package, replacing the CDN compat scripts.
//
// These values are public by design (Firebase web keys identify the project,
// they do not authorise anything). Access is controlled by firestore.rules and
// storage.rules. Anything actually secret lives server-side in api/.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
