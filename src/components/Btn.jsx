import { colors, fonts } from "../theme";

// Moved from Amelior8App.jsx — styling unchanged.
export function Btn({ children, onClick, primary = true, disabled = false, style: s = {} }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      padding: "14px", borderRadius: "16px", textAlign: "center",
      fontWeight: 700, fontSize: "14px", cursor: disabled ? "default" : "pointer",
      fontFamily: fonts.ui, letterSpacing: "-0.01em",
      background: primary ? colors.accent : "rgba(240, 235, 225, 0.55)",
      backdropFilter: primary ? "none" : "blur(20px)",
      WebkitBackdropFilter: primary ? "none" : "blur(20px)",
      color: primary ? colors.cloudDancer : colors.text,
      border: primary ? "none" : `1px solid rgba(107, 107, 82, 0.15)`,
      transition: "all 0.25s ease",
      opacity: disabled ? 0.4 : 1,
      boxShadow: primary
        ? `0 4px 20px ${colors.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.15)`
        : "0 2px 12px rgba(44,44,42,0.04), inset 0 1px 0 rgba(255,255,255,0.4)",
      ...s
    }}>{children}</div>
  );
}
