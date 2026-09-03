import { colors, fonts, radius } from "../theme";

export function InputField({ label, value, onChange, placeholder, type = "text", error }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 700,
        color: colors.textSecondary, marginBottom: "6px",
        fontFamily: fonts.caption, textTransform: "uppercase", letterSpacing: "0.07em",
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "13px 16px", borderRadius: radius.md,
          background: colors.surface,
          border: `1px solid ${error ? "rgba(224, 67, 59, 0.5)" : colors.border}`,
          fontSize: "14px", fontFamily: fonts.ui, color: colors.text,
          outline: "none",
        }}
      />
      {error && (
        <p style={{
          fontSize: "11px", color: colors.categoryMedical, margin: "5px 0 0",
          fontWeight: 600, fontFamily: fonts.ui,
        }}>{error}</p>
      )}
    </div>
  );
}
