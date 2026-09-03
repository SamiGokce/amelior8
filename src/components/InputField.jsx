import { colors, fonts, glass } from "../theme";

export function InputField({ label, value, onChange, placeholder, type = "text", error }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{
        display: "block", fontSize: "12px", fontWeight: 600,
        color: colors.textSecondary, marginBottom: "5px",
        letterSpacing: "0.04em", fontFamily: fonts.caption,
        textTransform: "uppercase",
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: "14px",
          border: error ? "1.5px solid #c44" : `1px solid rgba(107, 107, 82, 0.2)`,
          fontSize: "14px", fontFamily: fonts.body,
          background: "rgba(240, 235, 225, 0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: colors.text, outline: "none",
          boxSizing: "border-box",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 8px rgba(44,44,42,0.03), inset 0 1px 0 rgba(255,255,255,0.4)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = colors.accent;
          e.target.style.boxShadow = `0 0 0 3px ${colors.accentGlow}, 0 2px 8px rgba(44,44,42,0.03)`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "#c44" : "rgba(107, 107, 82, 0.2)";
          e.target.style.boxShadow = "0 2px 8px rgba(44,44,42,0.03), inset 0 1px 0 rgba(255,255,255,0.4)";
        }}
      />
      {error && <p style={{ fontSize: "11px", color: "#c44", margin: "4px 0 0", fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>}
    </div>
  );
}
