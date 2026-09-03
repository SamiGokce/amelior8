import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMyOrders, useMySubscriptions } from "../hooks/useOrder";
import { api } from "../lib/api";
import { formatUsd } from "../lib/format";
import { colors, fonts, surfaces } from "../theme";
import { Icon } from "../icons";
import { Btn } from "../components/Btn";
import { Loading } from "../components/States";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { orders, loading: loadingOrders } = useMyOrders();
  const { subscriptions, loading: loadingSubs, reload } = useMySubscriptions();
  const [cancelling, setCancelling] = useState(null);

  if (loadingOrders) return <Loading label="Loading your profile" />;

  const totalGiven = orders
    .filter((o) => o.paymentStatus === "succeeded")
    .reduce((sum, o) => sum + (o.totalCharged || 0), 0);

  const active = subscriptions.filter((s) => s.status === "active");

  async function cancel(subscriptionId) {
    setCancelling(subscriptionId);
    try {
      await api.cancelSubscription(subscriptionId);
      reload();
    } catch (err) {
      console.error("Could not cancel subscription:", err);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 style={{
        fontFamily: fonts.display, fontSize: "27px", fontWeight: 700, color: colors.text,
        margin: "6px 0 18px", letterSpacing: "-0.045em",
      }}>Account</h1>

      <div style={{ ...surfaces.card, padding: "16px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
          background: colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center",
        }}>{Icon.user(22, colors.accent)}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.ui }}>
            {user?.displayName || "Your account"}
          </p>
          <p style={{
            fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body,
            overflow: "hidden", textOverflow: "ellipsis",
          }}>{user?.email}</p>
        </div>
      </div>

      {!user?.emailVerified && (
        <div
          onClick={() => navigate("/verify-email")}
          style={{ ...surfaces.accent, padding: "12px", marginBottom: "10px", cursor: "pointer" }}
        >
          <p style={{ fontSize: "12px", fontWeight: 700, color: colors.accent, margin: "0 0 2px", fontFamily: fonts.ui }}>
            Verify your email
          </p>
          <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
            You will need to before your first gift can go through.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        {[
          { label: "Given", value: formatUsd(totalGiven) },
          { label: "Gifts", value: String(orders.filter((o) => o.paymentStatus === "succeeded").length) },
        ].map((stat) => (
          <div key={stat.label} style={{ ...surfaces.card, padding: "13px", flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.ui, letterSpacing: "-0.03em" }}>
              {stat.value}
            </p>
            <p style={{ fontSize: "10px", color: colors.textSecondary, margin: 0, fontFamily: fonts.caption, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div style={{ ...surfaces.card, padding: "14px", marginBottom: "10px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: colors.textSecondary, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.caption }}>
          Monthly gifts
        </p>
        {loadingSubs ? (
          <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>Loading</p>
        ) : active.length === 0 ? (
          <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
            You have no recurring gifts.
          </p>
        ) : (
          active.map((sub) => (
            <div key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", gap: "10px" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: colors.text, margin: 0, fontFamily: fonts.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sub.itemSnapshot?.name || "Monthly gift"}
                </p>
                <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
                  {formatUsd(sub.amountUsdCents)} each month
                </p>
              </div>
              <span
                onClick={() => cancelling !== sub.id && cancel(sub.id)}
                style={{
                  fontSize: "11px", fontWeight: 700, color: colors.accent,
                  cursor: "pointer", fontFamily: fonts.ui, flexShrink: 0,
                  opacity: cancelling === sub.id ? 0.5 : 1,
                }}
              >{cancelling === sub.id ? "Cancelling" : "Cancel"}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: "auto", paddingTop: "10px" }}>
        <Btn onClick={() => signOut().then(() => navigate("/"))} primary={false} style={{ width: "100%" }}>
          Sign out
        </Btn>
      </div>
    </div>
  );
}
