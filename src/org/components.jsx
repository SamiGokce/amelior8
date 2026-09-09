import { colors, fonts, radius, shadow, surfaces } from "../theme";
import { Icon } from "../icons";

export function Card({ children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ ...surfaces.card, padding: "16px", cursor: onClick ? "pointer" : "default", ...style }}
    >{children}</div>
  );
}

export function H1({ children, style = {} }) {
  return (
    <h1 style={{
      fontFamily: fonts.display, fontSize: "26px", fontWeight: 700, color: colors.text,
      margin: "0 0 6px", letterSpacing: "-0.045em", ...style,
    }}>{children}</h1>
  );
}

export function Muted({ children, style = {} }) {
  return (
    <p style={{
      fontSize: "13px", color: colors.textSecondary, margin: 0,
      lineHeight: 1.5, fontFamily: fonts.ui, ...style,
    }}>{children}</p>
  );
}

export function Label({ children }) {
  return (
    <span style={{
      fontSize: "10.5px", fontWeight: 700, color: colors.textTertiary,
      textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.caption,
    }}>{children}</span>
  );
}

const STATUS_STYLE = {
  FUNDED:          { label: "Needs a relay", bg: "rgba(204, 86, 2, 0.12)",  fg: "#A34602" },
  ASSIGNED:        { label: "Assigned",      bg: "rgba(59, 147, 224, 0.12)", fg: "#2A6FAA" },
  PURCHASED:       { label: "Bought",        bg: "rgba(123, 92, 214, 0.12)", fg: "#5B41A8" },
  DELIVERED:       { label: "Needs review",  bg: "rgba(204, 86, 2, 0.14)",  fg: "#A34602" },
  VERIFIED:        { label: "Verified",      bg: "rgba(90, 138, 100, 0.14)", fg: "#3D6B47" },
  PROOF_REJECTED:  { label: "Photo rejected", bg: "rgba(224, 67, 59, 0.12)", fg: "#B03028" },
  ON_HOLD:         { label: "On hold",       bg: "rgba(107, 107, 82, 0.14)", fg: "#5A5A45" },
  CANCELLED:       { label: "Cancelled",     bg: "rgba(107, 107, 82, 0.12)", fg: "#6B6B52" },
  REFUNDED:        { label: "Refunded",      bg: "rgba(107, 107, 82, 0.12)", fg: "#6B6B52" },
  PENDING_PAYMENT: { label: "Awaiting payment", bg: "rgba(107, 107, 82, 0.10)", fg: "#6B6B52" },
  PAYMENT_FAILED:  { label: "Payment failed", bg: "rgba(224, 67, 59, 0.12)", fg: "#B03028" },
};

export function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { label: status, bg: colors.surfaceMuted, fg: colors.textSecondary };
  return (
    <span style={{
      display: "inline-block", padding: "4px 9px", borderRadius: radius.pill,
      background: s.bg, color: s.fg, fontSize: "10.5px", fontWeight: 700,
      fontFamily: fonts.caption, whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

/** What the automatic check thought, stated as advice rather than a verdict. */
export function AiVerdict({ ai }) {
  if (!ai) return null;

  const tone = {
    passed:      { text: "Automatic check: looks right", fg: "#3D6B47", icon: "check" },
    flagged:     { text: "Automatic check: unclear",     fg: "#A34602", icon: "cpu" },
    failed:      { text: "Automatic check: problem found", fg: "#B03028", icon: "shield" },
    pending:     { text: "Automatic check running",      fg: colors.textSecondary, icon: "cpu" },
    unavailable: { text: "No automatic check available", fg: colors.textSecondary, icon: "cpu" },
  }[ai.state] || null;

  if (!tone) return null;

  return (
    <div style={{ ...surfaces.tile, padding: "12px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: ai.reasons?.length ? "7px" : 0 }}>
        {Icon[tone.icon](14, tone.fg)}
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: tone.fg, fontFamily: fonts.ui }}>
          {tone.text}
        </span>
        {typeof ai.score === "number" && (
          <span style={{ fontSize: "11px", color: colors.textTertiary, fontFamily: fonts.mono }}>
            {Math.round(ai.score * 100)}%
          </span>
        )}
      </div>
      {ai.reasons?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: "17px" }}>
          {ai.reasons.map((r, i) => (
            <li key={i} style={{
              fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.ui,
              lineHeight: 1.5, marginBottom: "2px",
            }}>{r}</li>
          ))}
        </ul>
      )}
      <p style={{
        fontSize: "11px", color: colors.textTertiary, margin: "8px 0 0",
        fontFamily: fonts.ui, lineHeight: 1.45,
      }}>
        This is guidance, not a decision. Your approval is what the donor sees.
      </p>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text", error, hint, ...rest }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", marginBottom: "6px" }}><Label>{label}</Label></label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box", padding: "12px 14px",
          borderRadius: radius.md, background: colors.surface,
          border: `1px solid ${error ? "rgba(224,67,59,0.5)" : colors.border}`,
          fontSize: "14px", fontFamily: fonts.ui, color: colors.text, outline: "none",
        }}
        {...rest}
      />
      {hint && !error && (
        <p style={{ fontSize: "11px", color: colors.textTertiary, margin: "5px 0 0", fontFamily: fonts.ui }}>{hint}</p>
      )}
      {error && (
        <p style={{ fontSize: "11px", color: "#B03028", margin: "5px 0 0", fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>
      )}
    </div>
  );
}

export function Select({ label, value, onChange, options, placeholder = "Choose one" }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", marginBottom: "6px" }}><Label>{label}</Label></label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "12px 14px",
          borderRadius: radius.md, background: colors.surface,
          border: `1px solid ${colors.border}`, fontSize: "14px",
          fontFamily: fonts.ui, color: value ? colors.text : colors.textTertiary, outline: "none",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", disabled, style = {}, type = "button" }) {
  const styles = {
    primary: { background: colors.charcoal, color: "#FFF", border: "none", boxShadow: shadow.cta },
    secondary: { background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, boxShadow: shadow.card },
    danger: { background: "#B03028", color: "#FFF", border: "none", boxShadow: shadow.cta },
    quiet: { background: "transparent", color: colors.textSecondary, border: "none", boxShadow: "none" },
  }[variant];

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: "12px 20px", borderRadius: radius.pill, fontSize: "13.5px",
        fontWeight: 700, fontFamily: fonts.ui, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1, transition: "opacity 0.15s ease",
        ...styles, ...style,
      }}
    >{children}</button>
  );
}

export function Banner({ tone = "info", children }) {
  const t = {
    info:    { bg: colors.surfaceMuted, fg: colors.text },
    warn:    { bg: "rgba(204, 86, 2, 0.10)", fg: "#A34602" },
    error:   { bg: "rgba(224, 67, 59, 0.10)", fg: "#B03028" },
    success: { bg: "rgba(90, 138, 100, 0.12)", fg: "#3D6B47" },
  }[tone];

  return (
    <div style={{
      background: t.bg, borderRadius: radius.md, padding: "12px 14px", marginBottom: "14px",
    }}>
      <p style={{ fontSize: "12.5px", color: t.fg, margin: 0, fontFamily: fonts.ui, lineHeight: 1.5, fontWeight: 600 }}>
        {children}
      </p>
    </div>
  );
}

export function Empty({ title, message, action, onAction }) {
  return (
    <Card style={{ textAlign: "center", padding: "36px 24px" }}>
      <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: fonts.ui }}>
        {title}
      </p>
      {message && <Muted style={{ marginBottom: action ? "16px" : 0 }}>{message}</Muted>}
      {action && onAction && <Button onClick={onAction}>{action}</Button>}
    </Card>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "48px 0" }}>
      <div style={{
        width: "26px", height: "26px", borderRadius: "50%",
        border: `2px solid ${colors.divider}`, borderTopColor: colors.charcoal,
        animation: "a8spin 0.8s linear infinite",
      }} />
      <style>{"@keyframes a8spin{to{transform:rotate(360deg)}}"}</style>
      <Muted>{label}</Muted>
    </div>
  );
}

export function money(cents) {
  if (cents === null || cents === undefined) return "--";
  const d = cents / 100;
  return d % 1 === 0 ? `$${d.toFixed(0)}` : `$${d.toFixed(2)}`;
}

export function when(iso) {
  if (!iso) return "--";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
