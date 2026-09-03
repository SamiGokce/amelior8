import { useNavigate, useParams } from "react-router-dom";
import { useCountries, useGiftItems, CATEGORY_META } from "../hooks/useCatalog";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Header } from "../components/Header";
import { CountryBadge } from "../components/CountryBadge";
import { EmptyState, Loading } from "../components/States";

export default function Countries() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { data: countries, loading: loadingCountries } = useCountries();
  const { data: items, loading: loadingItems } = useGiftItems();

  if (loadingCountries || loadingItems) return <Loading label="Loading countries" />;

  // Only countries that actually have a gift in this category — a dead end is
  // worse than a shorter list.
  const withCounts = countries
    .map((c) => ({
      ...c,
      giftCount: items.filter(
        (i) => i.category === category && i.countryCode === c.code && i.available !== false,
      ).length,
    }))
    .filter((c) => c.giftCount > 0);

  const label = CATEGORY_META[category]?.label || category;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title={label} onBack={() => navigate("/give")} />

      {withCounts.length === 0 ? (
        <EmptyState
          title={`No ${label.toLowerCase()} gifts available`}
          message="Nothing is listed in this category right now."
          action="Choose another cause"
          onAction={() => navigate("/give")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {withCounts.map((country) => (
            <div
              key={country.code}
              onClick={() => navigate(`/give/${category}/${country.code}`)}
              style={{
                ...glass.panel, padding: "14px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "12px",
              }}
            >
              <CountryBadge country={country} size={44} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.ui }}>{country.name}</p>
                <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
                  {country.giftCount} gift{country.giftCount === 1 ? "" : "s"} available
                </p>
              </div>
              {Icon.chevronRight(18, colors.textTertiary)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
