import { useNavigate } from "react-router-dom";
import { useMyOrders } from "../hooks/useOrder";
import { stageStates } from "../../shared/orderStatus";
import { formatDate, formatUsd } from "../lib/format";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Header } from "../components/Header";
import { EmptyState, Loading } from "../components/States";

export default function Orders() {
  const navigate = useNavigate();
  const { orders, loading } = useMyOrders();

  if (loading) return <Loading label="Loading your gifts" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Your gifts" onBack={() => navigate("/")} />

      {orders.length === 0 ? (
        <EmptyState
          title="No gifts yet"
          message="When you give, it will appear here and you can follow it through to delivery."
          action="Browse gifts"
          onAction={() => navigate("/give")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {orders.map((order) => {
            const stages = stageStates(order);
            const done = stages.filter((s) => s.state === "complete").length;
            return (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                style={{ ...glass.panel, padding: "13px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "13px", fontWeight: 700, color: colors.text, margin: "0 0 2px",
                      fontFamily: fonts.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{order.itemSnapshot?.name || "Gift"}</p>
                    <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
                      {order.countrySnapshot?.name || order.countryCode} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: colors.accent, margin: "0 0 2px", fontFamily: fonts.ui }}>
                      {formatUsd(order.totalCharged)}
                    </p>
                    {Icon.chevronRight(14, colors.textTertiary)}
                  </div>
                </div>

                {/* Four dots, one per stage — the whole journey at a glance. */}
                <div style={{ display: "flex", gap: "4px", marginTop: "10px" }}>
                  {stages.map((stage) => (
                    <div key={stage.key} style={{
                      flex: 1, height: "3px", borderRadius: "2px",
                      background: stage.state === "complete"
                        ? colors.success
                        : stage.state === "current"
                          ? colors.accent
                          : "rgba(107, 107, 82, 0.15)",
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: "10px", color: colors.textTertiary, margin: "6px 0 0", fontFamily: fonts.caption, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Stage {Math.min(done + (done < 4 ? 1 : 0), 4)} of 4
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
