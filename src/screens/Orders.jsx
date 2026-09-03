import { useNavigate } from "react-router-dom";
import { useMyOrders } from "../hooks/useOrder";
import { stageStates, statusExplanation } from "../../shared/orderStatus";
import { CATEGORY_META } from "../hooks/useCatalog";
import { formatDate, formatUsd } from "../lib/format";
import { colors, fonts, surfaces } from "../theme";
import { Thumb } from "../components/Catalog";
import { EmptyState, Loading } from "../components/States";

export default function Orders() {
  const navigate = useNavigate();
  const { orders, loading } = useMyOrders();

  if (loading) return <Loading label="Loading your gifts" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 style={{
        fontFamily: fonts.display, fontSize: "27px", fontWeight: 700, color: colors.text,
        margin: "6px 0 18px", letterSpacing: "-0.045em",
      }}>Activity</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="No gifts yet"
          message="When you give, it appears here and you can follow it through to delivery."
          action="Browse gifts"
          onAction={() => navigate("/give")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {orders.map((order) => {
            const stages = stageStates(order);
            const done = stages.filter((s) => s.state === "complete").length;
            const meta = CATEGORY_META[order.itemSnapshot?.category] || {};
            return (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                style={{ ...surfaces.card, padding: "13px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "11px" }}>
                  <Thumb src={order.itemSnapshot?.imageUrl} icon={meta.icon} tint={meta.color || colors.accent} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "13.5px", fontWeight: 700, color: colors.text, margin: "0 0 2px",
                      fontFamily: fonts.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{order.itemSnapshot?.name || "Gift"}</p>
                    <p style={{ fontSize: "11.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>
                      {order.countrySnapshot?.name || order.countryCode} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui, flexShrink: 0 }}>
                    {formatUsd(order.totalCharged)}
                  </span>
                </div>

                <p style={{ fontSize: "11.5px", color: colors.textSecondary, margin: "10px 0 9px", lineHeight: 1.45, fontFamily: fonts.ui }}>
                  {statusExplanation(order)}
                </p>

                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  {stages.map((stage) => (
                    <div key={stage.key} style={{
                      flex: 1, height: "3px", borderRadius: "2px",
                      background: stage.state === "complete"
                        ? colors.charcoal
                        : stage.state === "current"
                          ? colors.accent
                          : colors.surfaceSunken,
                    }} />
                  ))}
                  <span style={{
                    fontSize: "10px", fontWeight: 700, color: colors.textTertiary,
                    fontFamily: fonts.caption, marginLeft: "6px", flexShrink: 0,
                  }}>{Math.min(done + (done < 4 ? 1 : 0), 4)}/4</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
