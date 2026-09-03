import { colors, fonts, radius } from "../theme";
import { Icon } from "../icons";

export function SearchField({ value, onChange, placeholder = "What would you like to help with?" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      background: colors.surface, borderRadius: radius.pill,
      padding: "13px 18px", border: `1px solid ${colors.border}`,
    }}>
      {Icon.search(17, colors.textTertiary)}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontSize: "13px", fontFamily: fonts.ui, color: colors.text,
          minWidth: 0, padding: 0,
        }}
      />
    </div>
  );
}
