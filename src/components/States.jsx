import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Btn } from "./Btn";

export function Loading({ label = "Loading" }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "12px",
    }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%",
        border: `2px solid ${colors.divider}`,
        borderTopColor: colors.accent,
        animation: "a8spin 0.8s linear infinite",
      }} />
      <style>{"@keyframes a8spin{to{transform:rotate(360deg)}}"}</style>
      <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>{label}</p>
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry, retryLabel = "Try again" }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 8px",
    }}>
      <div style={{
        width: "56px", height: "56px", borderRadius: "50%",
        background: colors.accentLight, margin: "0 0 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{Icon.shield(24, colors.accent)}</div>
      <h2 style={{
        fontFamily: fonts.display, fontSize: "18px", fontWeight: 700,
        color: colors.text, margin: "0 0 8px", letterSpacing: "-0.03em",
      }}>{title}</h2>
      {message && (
        <p style={{
          fontSize: "13px", color: colors.textSecondary, margin: "0 0 20px",
          lineHeight: 1.5, fontFamily: fonts.body,
        }}>{message}</p>
      )}
      {onRetry && <Btn onClick={onRetry} style={{ width: "100%" }}>{retryLabel}</Btn>}
    </div>
  );
}

export function EmptyState({ icon = "gift", title, message, action, onAction }) {
  return (
    <div style={{
      ...glass.panelLight, padding: "28px 20px", textAlign: "center", marginTop: "8px",
    }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "50%",
        background: colors.accentLight, margin: "0 auto 14px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{Icon[icon] ? Icon[icon](22, colors.accent) : null}</div>
      <p style={{
        fontSize: "14px", fontWeight: 700, color: colors.text,
        margin: "0 0 6px", fontFamily: fonts.ui,
      }}>{title}</p>
      {message && (
        <p style={{
          fontSize: "12px", color: colors.textSecondary, margin: "0 0 16px",
          lineHeight: 1.5, fontFamily: fonts.body,
        }}>{message}</p>
      )}
      {action && onAction && <Btn onClick={onAction} style={{ width: "100%" }}>{action}</Btn>}
    </div>
  );
}
