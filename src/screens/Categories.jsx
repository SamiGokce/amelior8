import { useNavigate } from "react-router-dom";
import { useCategories } from "../hooks/useCatalog";
import { colors, fonts, surfaces } from "../theme";
import { renderIcon, Icon } from "../icons";
import { Header } from "../components/Header";
import { EmptyState, ErrorState, Loading } from "../components/States";

export default function Categories() {
  const navigate = useNavigate();
  const { categories, loading, error } = useCategories();

  if (loading) return <Loading label="Loading gifts" />;
  if (error) {
    return <ErrorState
      title="Could not load the catalog"
      message="Check your connection and try again."
      onRetry={() => window.location.reload()}
    />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Header onBack={() => navigate("/")} />

      <h1 style={{
        fontFamily: fonts.display, fontSize: "27px", fontWeight: 700, color: colors.text,
        margin: "0 0 18px", letterSpacing: "-0.045em", lineHeight: 1.15,
      }}>What would you<br />like to help with?</h1>

      {categories.length === 0 ? (
        <EmptyState
          title="No gifts listed yet"
          message="The catalog is empty. Run the seed script, or check back shortly."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {categories.map((cat) => (
            <div
              key={cat.key}
              onClick={() => navigate(`/give/${cat.key}`)}
              style={{
                ...surfaces.card, padding: "14px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "13px",
              }}
            >
              <div style={{
                width: "46px", height: "46px", borderRadius: "15px",
                background: `${cat.color}1A`, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{renderIcon(cat.icon, 22, cat.color)}</div>
              <p style={{
                flex: 1, fontSize: "15px", fontWeight: 700, color: colors.text,
                margin: 0, fontFamily: fonts.ui,
              }}>{cat.label}</p>
              {Icon.chevronRight(18, colors.textTertiary)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
