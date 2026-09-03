import { useNavigate } from "react-router-dom";
import { colors, fonts } from "../theme";
import { Icon } from "../icons";

// Moved from Amelior8App.jsx — styling unchanged. Back now goes through the
// router instead of the old in-memory history stack.
export function Header({ title, showBack = true, rightAction, onBack }) {
  const navigate = useNavigate();
  const back = onBack || (() => navigate(-1));

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 0 14px", borderBottom: `1px solid ${colors.divider}`, marginBottom: "16px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {showBack && (
          <div onClick={back} style={{
            cursor: "pointer", width: "28px", height: "28px", borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: colors.accentLight, transition: "all 0.2s ease",
          }}>{Icon.arrowLeft(16, colors.accent)}</div>
        )}
        <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui, letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {rightAction || (
        <span style={{ fontSize: "10px", color: colors.accent, fontWeight: 700, letterSpacing: "-0.05em", fontFamily: fonts.display }}>Amelior8</span>
      )}
    </div>
  );
}
