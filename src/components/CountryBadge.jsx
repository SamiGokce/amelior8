import Flag from "react-world-flags";

export function CountryBadge({ country, size = 44 }) {
  const r = size * 0.32;
  return (
    <div style={{
      width: size, height: size, borderRadius: r, overflow: "hidden",
      position: "relative", flexShrink: 0,
      boxShadow: "0 2px 8px rgba(44,44,42,0.08), inset 0 0 0 1px rgba(255,255,255,0.2)",
    }}>
      <Flag code={country.code} style={{
        display: "block", width: "100%", height: "100%", objectFit: "cover",
      }} />
    </div>
  );
}
