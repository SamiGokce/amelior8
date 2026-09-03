import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMyOrders } from "../hooks/useOrder";
import { stageStates, statusExplanation } from "../../shared/orderStatus";
import { formatUsd } from "../lib/format";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Btn } from "../components/Btn";

export default function Home() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { orders } = useMyOrders();

  const firstName = user?.displayName?.split(" ")[0] || "";
  const active = orders.find((o) => !["VERIFIED", "REFUNDED", "PAYMENT_FAILED"].includes(o.status));
  const totalGiven = orders
    .filter((o) => o.paymentStatus === "succeeded")
    .reduce((sum, o) => sum + (o.totalCharged || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "4px 0 18px" }}>
        <div>
          <p style={{ fontSize: "11px", color: colors.textSecondary, margin: "0 0 3px", fontFamily: fonts.caption, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            {user ? "Welcome back" : "Welcome"}
          </p>
          <h1 style={{ fontFamily: fonts.display, fontSize: "22px", fontWeight: 700, color: colors.text, margin: 0, letterSpacing: "-0.05em" }}>
            {firstName || "Amelior8"}
          </h1>
        </div>
        <div
          onClick={() => navigate(user ? "/profile" : "/signin")}
          style={{
            width: "36px", height: "36px", borderRadius: "12px", cursor: "pointer",
            background: colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >{Icon.user(18, colors.accent)}</div>
      </div>

      {/* One live gift, front and centre. */}
      {active && (
        <div
          onClick={() => navigate(`/orders/${active.id}`)}
          style={{ ...glass.panel, padding: "14px", marginBottom: "10px", cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p style={{ fontSize: "10px", color: colors.textSecondary, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontFamily: fonts.caption }}>
              In progress
            </p>
            {Icon.chevronRight(16, colors.textTertiary)}
          </div>
          <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: fonts.ui }}>
            {active.itemSnapshot?.name || "Your gift"}
          </p>
          <p style={{ fontSize: "11px", color: colors.textSecondary, margin: "0 0 10px", lineHeight: 1.45, fontFamily: fonts.body }}>
            {statusExplanation(active)}
          </p>
          <div style={{ display: "flex", gap: "4px" }}>
            {stageStates(active).map((stage) => (
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
        </div>
      )}

      {user && orders.length > 0 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {[
            { label: "Given", value: formatUsd(totalGiven) },
            { label: "Gifts", value: String(orders.filter((o) => o.paymentStatus === "succeeded").length) },
          ].map((stat) => (
            <div key={stat.label} style={{ ...glass.panelLight, padding: "12px", flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: "17px", fontWeight: 700, color: colors.accent, margin: "0 0 2px", fontFamily: fonts.ui, letterSpacing: "-0.02em" }}>
                {stat.value}
              </p>
              <p style={{ fontSize: "10px", color: colors.textSecondary, margin: 0, fontFamily: fonts.caption, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...glass.panelAccent, padding: "16px", marginBottom: "10px" }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", fontWeight: 700, color: colors.text, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
          Give something real
        </h2>
        <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.body }}>
          Pick a specific gift. A vetted local GR8 buys it, delivers it in person,
          and sends you a photo of the handover.
        </p>
      </div>

      <div style={{ marginTop: "auto", paddingTop: "10px" }}>
        <Btn onClick={() => navigate("/give")} style={{ width: "100%" }}>
          {orders.length > 0 ? "Give again" : "Choose a gift"}
        </Btn>
        {!user && !loading && (
          <p
            onClick={() => navigate("/signin")}
            style={{ fontSize: "12px", color: colors.textSecondary, margin: "12px 0 0", textAlign: "center", fontFamily: fonts.body, cursor: "pointer" }}
          >
            Already given? <span style={{ color: colors.accent, fontWeight: 700 }}>Sign in</span>
          </p>
        )}
      </div>
    </div>
  );
}
