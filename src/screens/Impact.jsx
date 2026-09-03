import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMyOrders } from "../hooks/useOrder";
import { STATUS } from "../../shared/orderStatus";
import { CATEGORY_META } from "../hooks/useCatalog";
import { api } from "../lib/api";
import { formatDate, formatUsd } from "../lib/format";
import { colors, fonts, radius, surfaces } from "../theme";
import { Icon, renderIcon } from "../icons";
import { EmptyState, Loading } from "../components/States";

/** Proof thumbnails need a signed URL each — fetched per card, not up front. */
function ProofThumb({ orderId, fallbackIcon, tint }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getProofUrl(orderId).then((res) => { if (alive) setUrl(res.url); }).catch(() => {});
    return () => { alive = false; };
  }, [orderId]);

  if (url) {
    return <img src={url} alt="" style={{
      width: "100%", aspectRatio: "1", objectFit: "cover",
      borderRadius: radius.md, display: "block",
    }} />;
  }
  return (
    <div style={{
      width: "100%", aspectRatio: "1", borderRadius: radius.md,
      background: `${tint}14`, display: "flex", alignItems: "center", justifyContent: "center",
    }}>{renderIcon(fallbackIcon || "gift", 22, tint)}</div>
  );
}

export default function Impact() {
  const navigate = useNavigate();
  const { orders, loading } = useMyOrders();

  if (loading) return <Loading label="Loading your impact" />;

  const delivered = orders.filter((o) => o.proofPhotoPath && o.status === STATUS.VERIFIED);
  const totalGiven = orders
    .filter((o) => o.paymentStatus === "succeeded")
    .reduce((sum, o) => sum + (o.totalCharged || 0), 0);
  const countries = new Set(orders.filter((o) => o.paymentStatus === "succeeded").map((o) => o.countryCode));

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 style={{
        fontFamily: fonts.display, fontSize: "27px", fontWeight: 700, color: colors.text,
        margin: "6px 0 4px", letterSpacing: "-0.045em",
      }}>Impact</h1>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 18px", fontFamily: fonts.ui }}>
        Everything you have helped make possible.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
        {[
          { label: "Given", value: formatUsd(totalGiven) },
          { label: "Gifts", value: String(orders.filter((o) => o.paymentStatus === "succeeded").length) },
          { label: "Countries", value: String(countries.size) },
        ].map((stat) => (
          <div key={stat.label} style={{ ...surfaces.card, padding: "13px 10px", flex: 1, textAlign: "center" }}>
            <p style={{
              fontSize: "18px", fontWeight: 700, color: colors.text, margin: "0 0 2px",
              fontFamily: fonts.ui, letterSpacing: "-0.03em",
            }}>{stat.value}</p>
            <p style={{
              fontSize: "10px", color: colors.textTertiary, margin: 0, fontFamily: fonts.caption,
              textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
            }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {delivered.length === 0 ? (
        <div style={{ marginTop: "12px" }}>
          <EmptyState
            title="No deliveries yet"
            message="Once a gift is delivered and its photo is verified, it shows up here."
            action="Browse gifts"
            onAction={() => navigate("/give")}
          />
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px", marginTop: "12px",
        }}>
          {delivered.map((order) => {
            const meta = CATEGORY_META[order.itemSnapshot?.category] || {};
            return (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                style={{ ...surfaces.card, padding: "8px", cursor: "pointer" }}
              >
                <ProofThumb orderId={order.id} fallbackIcon={meta.icon} tint={meta.color || colors.accent} />
                <p style={{
                  fontSize: "12px", fontWeight: 700, color: colors.text, margin: "8px 2px 2px",
                  fontFamily: fonts.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{order.itemSnapshot?.name}</p>
                <p style={{ fontSize: "10.5px", color: colors.textTertiary, margin: "0 2px 4px", fontFamily: fonts.ui }}>
                  {order.countrySnapshot?.name || order.countryCode} · {formatDate(order.stageTimestamps?.delivered || order.createdAt)}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", margin: "0 2px" }}>
                  {Icon.check(11, colors.successText)}
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: colors.successText, fontFamily: fonts.caption }}>
                    Verified
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
