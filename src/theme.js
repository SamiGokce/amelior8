// Design tokens.
//
// The palette and type scale come from BRAND.md. The surface treatment is the
// light card system from the approved mockups: white cards on a near-white
// ground, soft shadows, Charcoal pill CTAs. Burnt Orange stays the accent.

export const colors = {
  // Brand palette (BRAND.md)
  burntOrange: "#CC5602",
  cloudDancer: "#F0EBE1",
  charcoal: "#2C2C2A",
  oliveDrab: "#6B6B52",
  dustyTeal: "#7A9A94",

  // Surfaces
  page: "#F4F3F1",       // app ground, a touch warm toward Cloud Dancer
  surface: "#FFFFFF",    // cards
  surfaceMuted: "#F2F1EE", // search field, inactive chips
  surfaceSunken: "#EDECE8",

  // Semantic
  accent: "#CC5602",
  accentLight: "rgba(204, 86, 2, 0.10)",
  accentGlow: "rgba(204, 86, 2, 0.22)",
  text: "#1C1C1A",
  textSecondary: "#6B6B52",
  textTertiary: "#9A9A8C",
  border: "rgba(28, 28, 26, 0.07)",
  divider: "rgba(28, 28, 26, 0.06)",
  success: "#5A8A64",
  successText: "#3D6B47",
  star: "#F5A623",

  // Category accents, per the mockup
  categoryEducation: "#7B5CD6",
  categoryClothing: "#3FA46A",
  categoryFood: "#CC5602",
  categoryWater: "#3B93E0",
  categoryMedical: "#E0433B",
};

export const fonts = {
  display: "'Bricolage Grotesque', 'Georgia', serif",
  ui: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
  body: "'Georgia', 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'Courier New', monospace",
  caption: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
};

export const radius = {
  sm: "10px",
  md: "14px",
  lg: "18px",
  xl: "24px",
  pill: "999px",
};

export const shadow = {
  card: "0 1px 2px rgba(28, 28, 26, 0.04), 0 4px 16px rgba(28, 28, 26, 0.04)",
  raised: "0 2px 6px rgba(28, 28, 26, 0.06), 0 10px 30px rgba(28, 28, 26, 0.07)",
  cta: "0 4px 14px rgba(28, 28, 26, 0.18)",
};

export const surfaces = {
  card: {
    background: colors.surface,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
  },
  cardFlat: {
    background: colors.surface,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
  },
  tile: {
    background: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  accent: {
    background: colors.accentLight,
    borderRadius: radius.lg,
  },
  success: {
    background: "rgba(90, 138, 100, 0.10)",
    borderRadius: radius.lg,
  },
};

// Kept so older imports keep resolving to the current card treatment.
export const glass = {
  panel: surfaces.card,
  panelLight: surfaces.cardFlat,
  panelAccent: surfaces.accent,
  panelSuccess: surfaces.success,
};
