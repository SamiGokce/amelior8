import { useNavigate, useParams } from "react-router-dom";
import { useCountries, useGiftItems, usePartners, CATEGORY_META } from "../hooks/useCatalog";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header
        title={`${CATEGORY_META[category]?.label || category} in ${country?.name || countryCode}`}
        onBack={() => navigate(`/give/${category}`)}
      />

      {matching.length === 0 ? (
        <EmptyState
          title="Nothing listed here yet"
          message="No gifts in this category and country right now."
          action="Back to countries"
          onAction={() => navigate(`/give/${category}`)}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {matching.map((item) => {
            const total = item.priceUsdCents + item.facilitatorFeeUsdCents + item.platformFeeUsdCents;
            const unavailable = item.available === false;
            return (
              <div
                key={item.id}
                onClick={() => !unavailable && navigate(`/gift/${item.id}`)}
                style={{
                  ...glass.panel, padding: "14px",
                  cursor: unavailable ? "default" : "pointer",
                  // Unavailable items stay visible and are shown as unavailable,
                  // rather than quietly disappearing from the list.
                  opacity: unavailable ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: fonts.ui }}>{item.name}</p>
                    <p style={{ fontSize: "12px", color: colors.textSecondary, margin: "0 0 8px", lineHeight: 1.45, fontFamily: fonts.body }}>
                      {item.description}
                    </p>
                    <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.caption, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                      {partnerName(item.partnerId)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: colors.accent, margin: "0 0 2px", fontFamily: fonts.ui, letterSpacing: "-0.02em" }}>
                      {formatUsd(total)}
                    </p>
                    {unavailable
                      ? <p style={{ fontSize: "10px", color: colors.textSecondary, margin: 0, fontFamily: fonts.caption, fontWeight: 700, textTransform: "uppercase" }}>Unavailable</p>
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
