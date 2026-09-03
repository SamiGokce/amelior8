import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authErrorMessage, useAuth } from "../hooks/useAuth";
import { colors, fonts, glass } from "../theme";
import { Btn } from "../components/Btn";
import { InputField } from "../components/InputField";

export default function SignUp() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    if (password.length < 6) errs.password = "Use at least 6 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      await signUp(email, password, name);
      navigate("/verify-email", { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: "24px", marginBottom: "20px" }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: colors.accent, margin: "0 0 20px", letterSpacing: "-0.05em", fontFamily: fonts.display }}>Amelior8</p>
        <h1 style={{ fontFamily: fonts.display, fontSize: "24px", fontWeight: 700, color: colors.text, margin: "0 0 6px", letterSpacing: "-0.05em" }}>Create your account</h1>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>You will need one to track your gift through to delivery.</p>
      </div>

      <InputField label="Full name" value={name} onChange={setName} placeholder="Your name" error={errors.name} />
      <InputField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" error={errors.email} />
      <InputField label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" error={errors.password} />

      {error && (
        <div style={{ ...glass.panelAccent, padding: "10px 12px", marginBottom: "12px" }}>
          <p style={{ fontSize: "12px", color: colors.accent, margin: 0, fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>
        </div>
      )}

      <Btn onClick={submit} disabled={busy} style={{ marginBottom: "10px" }}>
        {busy ? "Creating account..." : "Create account"}
      </Btn>

      <Btn onClick={() => signInWithGoogle().then(() => navigate("/")).catch((e) => setError(authErrorMessage(e)))} primary={false} disabled={busy}>
        Continue with Google
      </Btn>

      <div style={{ marginTop: "auto", paddingTop: "20px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
          Already have an account?{" "}
          <Link to="/signin" style={{ color: colors.accent, fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
