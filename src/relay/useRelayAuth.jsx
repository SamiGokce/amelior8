import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { relayApi } from "./api";
import { relayEmail } from "../../shared/roles";

const Ctx = createContext(null);

// Dev-only. Statically false in a production build, so this and everything it
// guards is dropped at build time.
const PREVIEW = import.meta.env.DEV
  && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("preview") === "1";


/**
 * Relay auth: a username and a PIN.
 *
 * Underneath it is an ordinary Firebase email/password account under a
 * synthesized address, so token issuance, credential hashing and failed-attempt
 * throttling are all Firebase's rather than ours. The relay never sees an email
 * address, and no password is stored anywhere in this app.
 *
 * Persistence is local on purpose: a relay signs in once and stays signed in,
 * including across the offline periods this app is built for.
 */
export function RelayAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    if (PREVIEW) {
      relayApi.me().then(setProfile).catch(() => {}).finally(() => setLoading(false));
      return undefined;
    }
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          setProfile(await relayApi.me());
          setBlocked(null);
        } catch (err) {
          setProfile(null);
          // Deactivated, or signed in with a non-relay account.
          if (err?.status === 403) setBlocked(err.message);
        }
      } else {
        setProfile(null);
        setBlocked(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    relay: profile?.relay || null,
    org: profile?.org || null,
    loading,
    blocked,

    async signIn(username, pin) {
      const cred = await signInWithEmailAndPassword(auth, relayEmail(username), pin);
      return cred.user;
    },

    signOut: () => signOut(auth),
  }), [user, profile, loading, blocked]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRelayAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRelayAuth must be used inside <RelayAuthProvider>");
  return ctx;
}

/** Firebase error codes, said in terms a relay would recognise. */
export function signInError(err) {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "That username or PIN is not right. Check with your organisation.";
    case "auth/user-disabled":
      return "This account has been turned off. Ask your organisation.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "No connection. You need signal to sign in the first time.";
    default:
      return "Could not sign in. Try again.";
  }
}
