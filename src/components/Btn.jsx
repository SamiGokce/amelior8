import { colors, fonts, radius, shadow } from "../theme";
import { Icon } from "../icons";

/**
 * Primary CTA: full-width Charcoal pill with a trailing arrow.
 *
 * Charcoal rather than Burnt Orange — see BRAND.md's approved dark surface.
 * Orange stays the accent colour for emphasis and state.
 */
export function Btn({
  children,
  onClick,
  primary = true,
  disabled = false,
  arrow = true,
  style: s = {},
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        position: "relative",
        padding: "16px 22px",
        borderRadius: radius.pill,
        textAlign: "center",
        fontWeight: 700,
        fontSize: "15px",
        cursor: disabled ? "default" : "pointer",
        fontFamily: fonts.ui,
        letterSpacing: "-0.01em",
        background: primary ? colors.charcoal : colors.surface,
        color: primary ? "#FFFFFF" : colors.text,
        border: primary ? "none" : `1px solid ${colors.border}`,
        boxShadow: primary ? shadow.cta : shadow.card,
        transition: "transform 0.15s ease, opacity 0.15s ease",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...s,
      }}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {arrow && (
        <span style={{ position: "absolute", right: "20px", display: "flex" }}>
          {Icon.arrowRight(18, primary ? "#FFFFFF" : colors.text)}
        </span>
      )}
    </div>
  );
}

/** Circular icon button — back, favourite, share. */
export function IconButton({ icon, onClick, size = 40, color, background, badge = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: background || colors.surface,
        boxShadow: shadow.card,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {Icon[icon] ? Icon[icon](Math.round(size * 0.45), color || colors.text) : null}
      {badge && (
        <span style={{
          position: "absolute", top: "8px", right: "8px",
          width: "7px", height: "7px", borderRadius: "50%",
          background: colors.accent, border: `1.5px solid ${colors.surface}`,
        }} />
      )}
    </div>
  );
}

/** Selectable pill, used for the amount chips. */
export function Chip({ children, selected, onClick, style: s = {} }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "11px 16px",
        borderRadius: radius.pill,
        fontSize: "13px",
        fontWeight: 700,
        fontFamily: fonts.ui,
        textAlign: "center",
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: selected ? colors.charcoal : colors.surfaceMuted,
        color: selected ? "#FFFFFF" : colors.text,
        transition: "background 0.15s ease, color 0.15s ease",
        ...s,
      }}
    >{children}</div>
  );
}
