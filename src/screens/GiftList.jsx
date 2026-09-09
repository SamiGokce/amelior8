import { useNavigate, useParams } from "react-router-dom";
import { useCountries, useGiftItems, usePartners, CATEGORY_META } from "../hooks/useCatalog";
import { colors, fonts, radius, surfaces } from "../theme";
import { Icon, renderIcon } from "../icons";
import { formatUsd } from "../lib/format";
import { Header } from "../components/Header";
import { EmptyState, Loading } from "../components/States";

export default function GiftList() {
  const { category, countryCode } = useParams();
  const navigate = useNavigate();
  const { data: items, loading } = useGiftItems();
  const { data: partners } = usePartners();
  const { data: countries } = useCountries();

  if (loading) return <Loading label="Loading gifts" />;

  const country = countries.find((c) => c.code === countryCode);
  const matching = items.filter((i) => i.category === category && i.countryCode === countryCode);
  const partnerName = (id) => partners.find((p) => p.partnerId === id || p.id === id)?.name || "";
  const meta = CATEGORY_META[category] || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Header onBack={() => navigate(`/give/${category}`)} />

      <h1 style={{
        fontFamily: fonts.display, fontSize: "25px", fontWeight: 700, color: colors.text,
        margin: "0 0 18px", letterSpacing: "-0.045em", lineHeight: 1.15,
      }}>{meta.label || category} in {country?.name || countryCode}</h1>

      {matching.length === 0 ? (
        <EmptyState
          title="Nothing listed here yet"
          message="No gifts in this category and country right now."
          action="Back to countries"
          onAction={() => navigate(`/give/${category}`)}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {matching.map((item) => {
            const total = item.priceUsdCents + item.relayFeeUsdCents + item.platformFeeUsdCents;
            const unavailable = item.available === false;
            return (
              <div
                key={item.id}
                onClick={() => !unavailable && navigate(`/gift/${item.id}`)}
                style={{
                  ...surfaces.card, padding: "13px",
                  cursor: unavailable ? "default" : "pointer",
                  // Unavailable items stay visible and read as unavailable,
                  // rather than quietly vanishing from the list.
                  opacity: unavailable ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" style={{
                      width: "58px", height: "58px", borderRadius: radius.md,
                      objectFit: "cover", flexShrink: 0,
                    }} />
                  ) : (
                    <div style={{
                      width: "58px", height: "58px", borderRadius: radius.md, flexShrink: 0,
                      background: `${meta.color || colors.accent}14`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{renderIcon(meta.icon || "gift", 24, meta.color || colors.accent)}</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 3px", fontFamily: fonts.ui }}>
                      {item.name}
                    </p>
                    <p style={{
                      fontSize: "11.5px", color: colors.textSecondary, margin: "0 0 6px",
                      lineHeight: 1.45, fontFamily: fonts.body,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{item.description}</p>
                    <p style={{ fontSize: "10.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>
                      {partnerName(item.partnerId)}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{
                      fontSize: "15px", fontWeight: 700, color: colors.text, margin: "0 0 4px",
                      fontFamily: fonts.ui, letterSpacing: "-0.02em",
                    }}>{formatUsd(total)}</p>
                    {unavailable
                      ? <p style={{ fontSize: "9.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.caption, fontWeight: 700, textTransform: "uppercase" }}>Unavailable</p>
                      : Icon.chevronRight(16, colors.textTertiary)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
