import { useNavigate } from "react-router-dom";
import { useCategories } from "../hooks/useCatalog";
import { colors, fonts, glass } from "../theme";
import { renderIcon, Icon } from "../icons";
import { Header } from "../components/Header";
import { EmptyState, ErrorState, Loading } from "../components/States";

const CATEGORY_COLOR = {
  water: "#7A9A94",
  education: "#6B6B52",
  health: "#CC5602",
  food: "#8B7355",
};

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Choose a cause" onBack={() => navigate("/")} />

      {categories.length === 0 ? (
        <EmptyState
          title="No gifts listed yet"
          message="The catalog is empty. Run the seed script, or check back shortly."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {categories.map((cat) => (
            <div
              key={cat.key}
              onClick={() => navigate(`/give/${cat.key}`)}
              style={{
                ...glass.panel, padding: "16px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "14px",
              }}
            >
              <div style={{
                width: "44px", height: "44px", borderRadius: "14px",
                background: `${CATEGORY_COLOR[cat.key] || colors.accent}1A`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {renderIcon(cat.icon, 22, CATEGORY_COLOR[cat.key] || colors.accent)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: colors.text, margin: 0, fontFamily: fonts.ui }}>{cat.label}</p>
              </div>
              {Icon.chevronRight(18, colors.textTertiary)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
