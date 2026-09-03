import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Btn } from "../components/Btn";

/**
 * Firebase verifies the email on its own hosted page, so this screen polls the
 * token rather than waiting for a callback. Verification is required before a
 * first gift completes — the checkout endpoint enforces it server-side too.
 */
export default function VerifyEmail() {
  const { user, refreshUser, resendVerification, signOut } = useAuth();
  const navigate = useNavigate();
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/signin", { replace: true }); return undefined; }
    if (user.emailVerified) { navigate("/", { replace: true }); return undefined; }

    const timer = setInterval(async () => {
      const refreshed = await refreshUser();
      if (refreshed?.emailVerified) navigate("/", { replace: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [user, refreshUser, navigate]);

  async function checkNow() {
    setChecking(true);
    const refreshed = await refreshUser();
    setChecking(false);
    if (refreshed?.emailVerified) navigate("/", { replace: true });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%", background: colors.accentLight,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px",
      }}>{Icon.mail(28, colors.accent)}</div>

      <h1 style={{ fontFamily: fonts.display, fontSize: "20px", fontWeight: 700, color: colors.text, margin: "0 0 8px", letterSpacing: "-0.04em" }}>Verify your email</h1>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 20px", lineHeight: 1.5, fontFamily: fonts.body, padding: "0 8px" }}>
        We sent a link to <strong style={{ color: colors.text }}>{user?.email}</strong>. Open it, and this page will move on by itself.
      </p>

      {resent && (
        <div style={{ ...glass.panelSuccess, padding: "10px 12px", marginBottom: "12px", width: "100%", boxSizing: "border-box" }}>
          <p style={{ fontSize: "12px", color: colors.successText, margin: 0, fontWeight: 600, fontFamily: fonts.ui }}>Sent again — give it a minute.</p>
        </div>
      )}

      <Btn onClick={checkNow} disabled={checking} style={{ width: "100%", marginBottom: "10px" }}>
        {checking ? "Checking..." : "I have verified"}
      </Btn>
      <Btn onClick={() => { resendVerification(); setResent(true); }} primary={false} style={{ width: "100%" }}>
        Resend the email
      </Btn>

      <p onClick={() => signOut().then(() => navigate("/signin"))} style={{
        fontSize: "12px", color: colors.textSecondary, marginTop: "20px",
        fontFamily: fonts.body, cursor: "pointer",
      }}>Sign out</p>
    </div>
  );
}
