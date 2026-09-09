import { useEffect, useState } from "react";
import { authErrorMessage, useOrgAuth } from "../useOrgAuth";
import { colors, fonts } from "../../theme";
import { Banner, Button, Card, Field, H1, Muted } from "../components";

/**
 * One screen for every pre-role state: signing in, signing up, verifying an
 * email, and redeeming an invite. They are all the same journey — an invite
 * link just decides which end of it you start at.
 */
export default function Auth({ inviteToken }) {
  const {
    user, loading, noRole, emailVerified,
    signIn, signUp, resetPassword, resendVerification, refresh, redeemInvite, signOut,
  } = useOrgAuth();

  const [mode, setMode] = useState(inviteToken ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // Once signed in and verified, redeeming the invite is automatic — there is
  // nothing useful to ask the person at that point.
  useEffect(() => {
    if (!inviteToken || !user || !emailVerified || !noRole) return;
    let alive = true;
    (async () => {
      try {
        await redeemInvite(inviteToken);
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [inviteToken, user, emailVerified, noRole, redeemInvite]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await signUp(email, password, name);
      else await signIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email) return setError("Enter your email address first.");
    try {
      await resetPassword(email);
      setNotice(`If an account exists for ${email}, a reset link is on its way.`);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  const shell = (children) => (
    <div style={{
      minHeight: "100vh", background: colors.page, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px",
      fontFamily: fonts.ui,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <p style={{
          fontFamily: fonts.display, fontSize: "17px", fontWeight: 700,
          color: colors.text, letterSpacing: "-0.05em", margin: "0 0 22px",
        }}>a8 <span style={{ fontWeight: 500 }}>ameliorate</span> <span style={{ color: colors.textTertiary, fontWeight: 500 }}>for organisations</span></p>
        <Card>{children}</Card>
      </div>
    </div>
  );

  if (loading) return shell(<Muted>Loading</Muted>);

  // Signed in, email not yet verified.
  if (user && !emailVerified) {
    return shell(<>
      <H1 style={{ fontSize: "20px" }}>Verify your email</H1>
      <Muted style={{ marginBottom: "18px" }}>
        We sent a link to <strong>{user.email}</strong>. Open it, then come back here.
      </Muted>
      {notice && <Banner tone="success">{notice}</Banner>}
      <div style={{ display: "flex", gap: "8px" }}>
        <Button onClick={refresh}>I have verified</Button>
        <Button variant="secondary" onClick={() => { resendVerification(); setNotice("Sent again."); }}>
          Resend
        </Button>
      </div>
      <Button variant="quiet" onClick={signOut} style={{ padding: "12px 0", marginTop: "8px" }}>Sign out</Button>
    </>);
  }

  // Signed in and verified, but not a member of any organisation.
  if (user && noRole) {
    return shell(<>
      <H1 style={{ fontSize: "20px" }}>No organisation yet</H1>
      {error && <Banner tone="error">{error}</Banner>}
      <Muted style={{ marginBottom: "18px" }}>
        {inviteToken
          ? "Redeeming your invite..."
          : "This account is not part of an organisation. Ask your admin for an invite link, or sign in with the address the invite was sent to."}
      </Muted>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button variant="secondary" onClick={refresh}>Check again</Button>
        <Button variant="quiet" onClick={signOut}>Sign out</Button>
      </div>
    </>);
  }

  return shell(<>
    <H1 style={{ fontSize: "20px" }}>
      {mode === "signup" ? "Create your account" : "Sign in"}
    </H1>
    <Muted style={{ marginBottom: "18px" }}>
      {inviteToken
        ? "You have been invited to an organisation. Create an account with the address the invite was sent to."
        : "Manage the gifts your organisation is delivering."}
    </Muted>

    {error && <Banner tone="error">{error}</Banner>}
    {notice && <Banner tone="success">{notice}</Banner>}

    {mode === "signup" && (
      <Field label="Your name" value={name} onChange={setName} placeholder="Full name" />
    )}
    <Field label="Email" value={email} onChange={setEmail} placeholder="you@organisation.org" type="email" />
    <Field label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" />

    <Button onClick={submit} disabled={busy || !email || !password} style={{ width: "100%" }}>
      {busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
    </Button>

    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px" }}>
      <Button variant="quiet" style={{ padding: "6px 0" }} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}>
        {mode === "signup" ? "I already have an account" : "Create an account"}
      </Button>
      {mode === "signin" && (
        <Button variant="quiet" style={{ padding: "6px 0" }} onClick={forgot}>Forgot password</Button>
      )}
    </div>
  </>);
}
