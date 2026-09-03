import { colors, fonts } from "../theme";

/**
 * The wordmark: the "a8" mark set beside "ameliorate".
 *
 * BRAND.md: Bricolage Grotesque, -0.05em tracking, never restyled or spaced
 * differently.
 */
export function Wordmark({ size = 17 }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
      <span style={{
        fontFamily: fonts.display,
        fontSize: `${size + 2}px`,
        fontWeight: 800,
        color: colors.text,
        letterSpacing: "-0.05em",
      }}>a8</span>
      <span style={{
        fontFamily: fonts.display,
        fontSize: `${size}px`,
        fontWeight: 500,
        color: colors.text,
        letterSpacing: "-0.05em",
      }}>ameliorate</span>
    </div>
  );
}
