import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authErrorMessage, useAuth } from "../hooks/useAuth";
import { colors, fonts, surfaces } from "../theme";
import { Btn } from "../components/Btn";
import { InputField } from "../components/InputField";

export default function SignIn() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      navigate(next, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: "24px", marginBottom: "24px" }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: colors.accent, margin: "0 0 20px", letterSpacing: "-0.05em", fontFamily: fonts.display }}>Amelior8</p>
        <h1 style={{ fontFamily: fonts.display, fontSize: "24px", fontWeight: 700, color: colors.text, margin: "0 0 6px", letterSpacing: "-0.05em" }}>Welcome back</h1>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>Sign in to give and track your gifts.</p>
      </div>

      <InputField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      <InputField label="Password" value={password} onChange={setPassword} placeholder="Your password" type="password" />

      {error && (
        <div style={{ ...surfaces.accent, padding: "10px 12px", marginBottom: "12px" }}>
          <p style={{ fontSize: "12px", color: colors.accent, margin: 0, fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>
        </div>
      )}

      <Btn onClick={() => run(() => signIn(email, password))} disabled={busy || !email || !password} style={{ marginBottom: "10px" }}>
        {busy ? "Signing in..." : "Sign in"}
      </Btn>

      <Btn onClick={() => run(signInWithGoogle)} primary={false} disabled={busy}>
        Continue with Google
      </Btn>

      <div style={{ marginTop: "auto", paddingTop: "20px", textAlign: "center" }}>
        <Link to="/forgot-password" style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.body, textDecoration: "none" }}>
          Forgot your password?
        </Link>
        <p style={{ fontSize: "12px", color: colors.textSecondary, margin: "12px 0 0", fontFamily: fonts.body }}>
          New here?{" "}
          <Link to="/signup" style={{ color: colors.accent, fontWeight: 700, textDecoration: "none" }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
