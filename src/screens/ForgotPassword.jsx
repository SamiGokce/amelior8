import { useState } from "react";
import { Link } from "react-router-dom";
import { authErrorMessage, useAuth } from "../hooks/useAuth";
import { colors, fonts, surfaces } from "../theme";
import { Icon } from "../icons";
import { Btn } from "../components/Btn";
import { InputField } from "../components/InputField";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%", background: colors.accentLight,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px",
        }}>{Icon.mail(28, colors.accent)}</div>
        <h1 style={{ fontFamily: fonts.display, fontSize: "20px", fontWeight: 700, color: colors.text, margin: "0 0 8px", letterSpacing: "-0.04em" }}>Check your email</h1>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 24px", lineHeight: 1.5, fontFamily: fonts.body, padding: "0 8px" }}>
          If an account exists for {email}, a reset link is on its way.
        </p>
        <Link to="/signin" style={{ width: "100%", textDecoration: "none" }}>
          <Btn style={{ width: "100%" }}>Back to sign in</Btn>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: "24px", marginBottom: "24px" }}>
        <h1 style={{ fontFamily: fonts.display, fontSize: "22px", fontWeight: 700, color: colors.text, margin: "0 0 6px", letterSpacing: "-0.05em" }}>Reset your password</h1>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>We will email you a link to set a new one.</p>
      </div>

      <InputField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />

      {error && (
        <div style={{ ...surfaces.accent, padding: "10px 12px", marginBottom: "12px" }}>
          <p style={{ fontSize: "12px", color: colors.accent, margin: 0, fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>
        </div>
      )}

      <Btn onClick={submit} disabled={busy || !email}>{busy ? "Sending..." : "Send reset link"}</Btn>

      <div style={{ marginTop: "auto", paddingTop: "20px", textAlign: "center" }}>
        <Link to="/signin" style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.body, textDecoration: "none" }}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
