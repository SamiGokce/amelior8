import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { orgApi } from "./api";

const Ctx = createContext(null);

// Dev-only. Statically false in a production build, so this and everything it
// guards is dropped at build time.
const PREVIEW = import.meta.env.DEV
  && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("preview") === "1";


/**
 * Org staff auth.
 *
 * A person can hold a valid Firebase account and still have no org role — that
 * is exactly the state between signing up and redeeming an invite. So "signed
 * in" and "belongs to an org" are tracked separately, and the org identity
 * always comes from the server rather than from anything cached locally.
 */
export function OrgAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);   // { user, org } from /api/org/me
  const [loading, setLoading] = useState(true);
  const [noRole, setNoRole] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await orgApi.me());
      setNoRole(false);
    } catch (err) {
      setProfile(null);
      // 403 here means authenticated but not a member of any organisation.
      setNoRole(err?.status === 403);
    }
  }, []);

  useEffect(() => {
    if (!PREVIEW) return undefined;
    loadProfile().finally(() => setLoading(false));
    return undefined;
  }, [loadProfile]);

  useEffect(() => PREVIEW ? undefined : onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) await loadProfile();
    else { setProfile(null); setNoRole(false); }
    setLoading(false);
  }), [loadProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    org: profile?.org || null,
    isAdmin: !!profile?.user?.isAdmin,
    loading,
    noRole,
    emailVerified: !!user?.emailVerified,

    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),

    async signUp(email, password, name) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user);
      return cred.user;
    },

    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    resendVerification: () => auth.currentUser && sendEmailVerification(auth.currentUser),

    async refresh() {
      if (!auth.currentUser) return;
      await auth.currentUser.reload();
      // New claims only appear in a freshly minted token.
      await auth.currentUser.getIdToken(true);
      setUser({ ...auth.currentUser });
      await loadProfile();
    },

    /** Redeem an invite, then pull the new claims down. */
    async redeemInvite(token) {
      await orgApi.acceptInvite(token);
      await auth.currentUser.getIdToken(true);
      await loadProfile();
    },

    signOut: () => signOut(auth),
  }), [user, profile, loading, noRole, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrgAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOrgAuth must be used inside <OrgAuthProvider>");
  return ctx;
}

export function authErrorMessage(err) {
  switch (err?.code) {
    case "auth/invalid-email": return "That email address doesn't look right.";
    case "auth/missing-password": return "Enter your password.";
    case "auth/weak-password": return "Use at least 6 characters.";
    case "auth/email-already-in-use": return "There's already an account with that email. Sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password is incorrect.";
    case "auth/too-many-requests": return "Too many attempts. Try again in a few minutes.";
    default: return err?.message || "Something went wrong. Try again.";
  }
}
