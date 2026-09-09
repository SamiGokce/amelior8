import { useState } from "react";
import { signInError, useRelayAuth } from "../useRelayAuth";
import { colors, fonts, radius, shadow, surfaces } from "../../theme";

export default function SignIn() {
  const { signIn, blocked } = useRelayAuth();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim().toLowerCase(), pin);
    } catch (err) {
      setError(signInError(err));
      setBusy(false);
    }
  }

  const input = {
    width: "100%", boxSizing: "border-box", padding: "16px 18px",
    borderRadius: radius.md, background: colors.surface,
    border: `1px solid ${colors.border}`, fontSize: "17px",
    fontFamily: fonts.ui, color: colors.text, outline: "none",
    marginBottom: "12px",
  };

  return (
    <div style={{
      minHeight: "100vh", background: colors.page, display: "flex",
      flexDirection: "column", justifyContent: "center",
      padding: "28px 22px", fontFamily: fonts.ui,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <p style={{
        fontFamily: fonts.display, fontSize: "18px", fontWeight: 700,
        color: colors.text, letterSpacing: "-0.05em", margin: "0 0 30px",
      }}>a8 <span style={{ fontWeight: 500 }}>ameliorate</span></p>

      <h1 style={{
        fontFamily: fonts.display, fontSize: "27px", fontWeight: 700,
        color: colors.text, margin: "0 0 8px", letterSpacing: "-0.045em",
      }}>Sign in</h1>
      <p style={{ fontSize: "14px", color: colors.textSecondary, margin: "0 0 24px", fontFamily: fonts.ui, lineHeight: 1.5 }}>
        Use the username and PIN your organisation gave you.
      </p>

      {(error || blocked) && (
        <div style={{
          background: "rgba(224, 67, 59, 0.10)", borderRadius: radius.md,
          padding: "13px 15px", marginBottom: "14px",
        }}>
          <p style={{ fontSize: "13.5px", color: "#B03028", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
            {error || blocked}
          </p>
        </div>
      )}

      <form onSubmit={submit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          style={input}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
          placeholder="PIN"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          style={input}
        />

        <button
          type="submit"
          disabled={busy || !username || pin.length < 6}
          style={{
            width: "100%", padding: "17px", borderRadius: radius.pill,
            background: colors.charcoal, color: "#FFF", border: "none",
            fontSize: "16px", fontWeight: 700, fontFamily: fonts.ui,
            cursor: busy ? "default" : "pointer", boxShadow: shadow.cta,
            opacity: busy || !username || pin.length < 6 ? 0.45 : 1,
          }}
        >{busy ? "Signing in..." : "Sign in"}</button>
      </form>

      <p style={{
        fontSize: "12.5px", color: colors.textTertiary, margin: "22px 0 0",
        lineHeight: 1.55, fontFamily: fonts.ui,
      }}>
        You need a connection the first time you sign in. After that the app keeps
        you signed in and works without signal.
      </p>
    </div>
  );
}
