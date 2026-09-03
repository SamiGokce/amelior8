import { colors, fonts, radius, shadow } from "../theme";
import { Icon, renderIcon } from "../icons";

/** Rounded icon tile with a label beneath — the category row on Home. */
export function CategoryTile({ icon, label, color, onClick, active = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "7px", cursor: "pointer", flexShrink: 0, width: "60px",
      }}
    >
      <div style={{
        width: "54px", height: "54px", borderRadius: radius.lg,
        background: active ? color : `${color}1A`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: active ? shadow.card : "none",
        transition: "background 0.15s ease",
      }}>
        {renderIcon(icon, 25, active ? "#FFFFFF" : color)}
      </div>
      <span style={{
        fontSize: "10px", fontWeight: 600, color: colors.textSecondary,
        fontFamily: fonts.ui, textAlign: "center", lineHeight: 1.2, width: "100%",
      }}>{label}</span>
    </div>
  );
}

/**
 * Gift thumbnail. Falls back to a neutral tinted tile rather than a stand-in
 * photograph — a placeholder image of a real-looking person would misrepresent
 * a delivery that has not happened.
 */
export function Thumb({ src, size = 54, radiusPx = 14, icon = "gift", tint = colors.accent }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size, height: size, borderRadius: `${radiusPx}px`,
          objectFit: "cover", flexShrink: 0, display: "block",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: `${radiusPx}px`, flexShrink: 0,
      background: `${tint}14`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {renderIcon(icon, Math.round(size * 0.4), tint)}
    </div>
  );
}

/** A row in a list — thumbnail, stacked text, chevron. */
export function ListRow({ image, icon, tint, title, lines = [], right, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 0", cursor: onClick ? "pointer" : "default",
      }}
    >
      <Thumb src={image} icon={icon} tint={tint || colors.accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 3px",
          fontFamily: fonts.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</p>
        {lines.map((line, i) => (
          <p key={i} style={{
            fontSize: "11.5px", color: colors.textTertiary, margin: "0 0 2px",
            fontFamily: fonts.ui, display: "flex", alignItems: "center", gap: "4px",
          }}>{line}</p>
        ))}
      </div>
      {right || Icon.chevronRight(17, colors.textTertiary)}
    </div>
  );
}

/** Section heading with an optional trailing link. */
export function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      margin: "18px 0 4px",
    }}>
      <p style={{
        fontSize: "13.5px", fontWeight: 700, color: colors.text, margin: 0,
        fontFamily: fonts.ui, letterSpacing: "-0.01em",
      }}>{title}</p>
      {actionLabel && (
        <span
          onClick={onAction}
          style={{
            fontSize: "12px", color: colors.textTertiary, cursor: "pointer",
            fontFamily: fonts.ui, display: "flex", alignItems: "center", gap: "2px",
          }}
        >
          {actionLabel}{Icon.chevronRight(13, colors.textTertiary)}
        </span>
      )}
    </div>
  );
}
