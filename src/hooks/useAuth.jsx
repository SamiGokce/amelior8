import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

/** Creates users/{uid} on first sign-in. The only client write we allow, and
 *  firestore.rules pins it to the caller's own uid and profile fields. */
async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || "",
    photoURL: user.photoURL || null,
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (u) {
      try {
        await ensureUserDoc(u);
      } catch (err) {
        console.error("Could not create user document:", err);
      }
    }
    setUser(u);
    setLoading(false);
  }), []);

  const value = useMemo(() => ({
    user,
    loading,
    emailVerified: !!user?.emailVerified,

    async signUp(email, password, displayName) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
      await ensureUserDoc(cred.user);
      await sendEmailVerification(cred.user);
      return cred.user;
    },

    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),

    signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),

    signInWithApple: () => signInWithPopup(auth, new OAuthProvider("apple.com")),

    resetPassword: (email) => sendPasswordResetEmail(auth, email),

    resendVerification: () => auth.currentUser && sendEmailVerification(auth.currentUser),

    /** Re-reads the token so a just-verified email is picked up without a re-login. */
    async refreshUser() {
      if (!auth.currentUser) return null;
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
      return auth.currentUser;
    },

    signOut: () => signOut(auth),
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Firebase's error codes are not something to show a donor as-is. */
export function authErrorMessage(err) {
  switch (err?.code) {
    case "auth/invalid-email": return "That email address doesn't look right.";
    case "auth/missing-password": return "Enter your password.";
    case "auth/weak-password": return "Use at least 6 characters.";
    case "auth/email-already-in-use": return "There's already an account with that email.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password is incorrect.";
    case "auth/too-many-requests": return "Too many attempts. Try again in a few minutes.";
    case "auth/popup-closed-by-user": return "Sign-in was cancelled.";
    case "auth/operation-not-allowed": return "That sign-in method isn't enabled yet.";
    default: return err?.message || "Something went wrong. Try again.";
  }
}
