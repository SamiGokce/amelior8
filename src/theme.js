// Design tokens — moved verbatim from Amelior8App.jsx. Brand palette per BRAND.md.
// ============================================================
//  DESIGN TOKENS — Brand palette from BRAND.md
// ============================================================
export const glass = {
  panel: {
    background: "rgba(240, 235, 225, 0.5)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    border: "1px solid rgba(240, 235, 225, 0.7)",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(44, 44, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
  },
  panelLight: {
    background: "rgba(240, 235, 225, 0.35)",
    backdropFilter: "blur(16px) saturate(150%)",
    WebkitBackdropFilter: "blur(16px) saturate(150%)",
    border: "1px solid rgba(240, 235, 225, 0.5)",
    borderRadius: "16px",
    boxShadow: "0 2px 12px rgba(44, 44, 42, 0.03)",
  },
  panelAccent: {
    background: "rgba(204, 86, 2, 0.07)",
    backdropFilter: "blur(16px) saturate(150%)",
    WebkitBackdropFilter: "blur(16px) saturate(150%)",
    border: "1px solid rgba(204, 86, 2, 0.12)",
    borderRadius: "16px",
  },
  panelSuccess: {
    background: "rgba(122, 154, 148, 0.1)",
    backdropFilter: "blur(16px) saturate(150%)",
    WebkitBackdropFilter: "blur(16px) saturate(150%)",
    border: "1px solid rgba(122, 154, 148, 0.2)",
    borderRadius: "16px",
  },
};

export const colors = {
  // Brand palette
  burntOrange: "#CC5602",
  cloudDancer: "#F0EBE1",
  charcoal: "#2C2C2A",
  oliveDrab: "#6B6B52",
  dustyTeal: "#7A9A94",
  // Semantic aliases
  accent: "#CC5602",
  accentLight: "rgba(204, 86, 2, 0.1)",
  accentGlow: "rgba(204, 86, 2, 0.25)",
  text: "#2C2C2A",
  textSecondary: "#6B6B52",
  textTertiary: "#7A9A94",
  success: "#5A8A64",
  successText: "#3D6B47",
  divider: "rgba(107, 107, 82, 0.12)",
};

export const fonts = {
  display: "'Bricolage Grotesque', 'Georgia', serif",
  ui: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
  body: "'Georgia', 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'Courier New', monospace",
  caption: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
};
