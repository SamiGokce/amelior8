import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "../hooks/useOrder";
import { api } from "../lib/api";
import { formatDate, formatDateTime, formatUsd, toDate } from "../lib/format";
import { STATUS, stageStates, statusExplanation } from "../../shared/orderStatus";
import { colors, fonts, radius, surfaces } from "../theme";
import { Icon, renderIcon } from "../icons";
import { CATEGORY_META } from "../hooks/useCatalog";
import { Header } from "../components/Header";
import { Btn, IconButton } from "../components/Btn";
import { QRCode } from "../components/QRCode";
import { ErrorState, Loading } from "../components/States";

/** Says only what is actually true about the photo. */
function ProofBadge({ verification }) {
  const state = verification?.state || "none";
  const config = {
    passed: { label: "AI Verified", color: colors.successText, bg: "rgba(90, 138, 100, 0.14)", icon: "check" },
    overridden: { label: "Verified", color: colors.successText, bg: "rgba(90, 138, 100, 0.14)", icon: "check" },
    pending: { label: "Verification in review", color: colors.oliveDrab, bg: "rgba(107, 107, 82, 0.12)", icon: "cpu" },
    flagged: { label: "Verification in review", color: colors.oliveDrab, bg: "rgba(107, 107, 82, 0.12)", icon: "cpu" },
    failed: { label: "Verification in review", color: colors.oliveDrab, bg: "rgba(107, 107, 82, 0.12)", icon: "cpu" },
  }[state];
  if (!config) return null;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      background: config.bg, borderRadius: radius.pill, padding: "5px 10px",
    }}>
      {Icon[config.icon](12, config.color)}
      <span style={{ fontSize: "10px", fontWeight: 700, color: config.color, fontFamily: fonts.caption, letterSpacing: "0.02em" }}>
        {config.label}
      </span>
    </div>
  );
}

function ProofPhoto({ orderId, rounded = radius.xl }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getProofUrl(orderId)
      .then((res) => { if (alive) setUrl(res.url); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [orderId]);

  if (url) {
    return (
      <img src={url} alt="Delivery of your gift" style={{
        width: "100%", borderRadius: rounded, display: "block",
        aspectRatio: "4/3", objectFit: "cover",
      }} />
    );
  }
  return (
    <div style={{
      width: "100%", aspectRatio: "4/3", borderRadius: rounded,
      background: colors.surfaceSunken,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <p style={{ fontSize: "12px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>
        {failed ? "Photo could not be loaded" : "Loading photo"}
      </p>
    </div>
  );
}

function DeliveredBy({ order }) {
  const fac = order.facilitatorSnapshot;
  if (!fac) return null;
  const place = [order.partnerSnapshot?.location, order.countrySnapshot?.name || order.countryCode]
    .filter(Boolean).join(", ");

  return (
    <div style={{
      ...surfaces.card, padding: "13px 14px", marginTop: "12px",
      display: "flex", alignItems: "center", gap: "11px",
    }}>
      {fac.photoUrl ? (
        <img src={fac.photoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
          background: colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center",
        }}>{Icon.user(19, colors.accent)}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.ui }}>
          Delivered by {fac.name}
        </p>
        {place && (
          <p style={{ fontSize: "11.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>{place}</p>
        )}
      </div>
    </div>
  );
}

function Timeline({ order }) {
  const stages = stageStates(order);
  return (
    <div style={{ ...surfaces.card, padding: "16px" }}>
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const done = stage.state === "complete";
        const current = stage.state === "current";
        return (
          <div key={stage.key} style={{ display: "flex", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "21px", height: "21px", borderRadius: "50%", flexShrink: 0,
                background: done ? colors.charcoal : current ? colors.accentLight : colors.surfaceSunken,
                border: current ? `2px solid ${colors.accent}` : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {done && Icon.check(11, "#FFFFFF")}
              </div>
              {!isLast && (
                <div style={{
                  width: "2px", flex: 1, minHeight: "24px",
                  background: done ? colors.charcoal : colors.surfaceSunken,
                }} />
              )}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : "13px", flex: 1 }}>
              <p style={{
                fontSize: "13px", margin: "1px 0 2px", fontFamily: fonts.ui,
                fontWeight: done || current ? 700 : 600,
                color: done || current ? colors.text : colors.textTertiary,
              }}>{stage.label}</p>
              <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>
                {stage.at ? formatDateTime(stage.at) : current ? "In progress" : "Not yet"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Tracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { order, loading, error } = useOrder(orderId);
  const [showQr, setShowQr] = useState(false);

  if (loading) return <Loading label="Loading your gift" />;

  // A rules denial and a missing order look identical on purpose — one donor
  // must not be able to probe for another's order ids.
  if (error || !order) {
    return <ErrorState
      title="Gift not found"
      message="We could not find that gift on your account."
      onRetry={() => navigate("/activity")}
      retryLabel="Your gifts"
    />;
  }

  const eta = toDate(order.estimatedDeliveryAt);
  const meta = CATEGORY_META[order.itemSnapshot?.category] || {};
  const delivered = !!order.proofPhotoPath;
  const complete = order.status === STATUS.VERIFIED;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Header
        onBack={() => navigate("/activity")}
        actions={<IconButton icon="share" onClick={() => setShowQr((v) => !v)} />}
      />

      <h1 style={{
        fontFamily: fonts.display, fontSize: "26px", fontWeight: 700, color: colors.text,
        margin: "0 0 6px", letterSpacing: "-0.045em", lineHeight: 1.15,
      }}>
        {complete
          ? <>Your donation<br />made an impact.</>
          : order.itemSnapshot?.name || "Your gift"}
      </h1>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 16px", lineHeight: 1.5, fontFamily: fonts.ui }}>
        {complete ? "Here's what you helped make possible." : statusExplanation(order)}
      </p>

      {delivered ? (
        <>
          <ProofPhoto orderId={orderId} />
          <div style={{ marginTop: "10px" }}>
            <ProofBadge verification={order.verification} />
          </div>
        </>
      ) : (
        <>
          {eta && ![STATUS.REFUNDED, STATUS.CANCELLED].includes(order.status) && (
            <div style={{ ...surfaces.tile, padding: "11px 13px", marginBottom: "12px" }}>
              <p style={{ fontSize: "12px", color: colors.text, margin: 0, fontFamily: fonts.ui, fontWeight: 600 }}>
                Expected by {formatDate(eta)}
              </p>
            </div>
          )}
          <Timeline order={order} />
        </>
      )}

      <DeliveredBy order={order} />

      {/* Only rendered when a recipient actually said something. Never a
          stand-in quote. */}
      {order.recipientMessage && (
        <div style={{ ...surfaces.tile, padding: "15px", marginTop: "10px", display: "flex", gap: "10px" }}>
          <div style={{ flexShrink: 0, paddingTop: "2px" }}>{Icon.quote(17, colors.textTertiary)}</div>
          <p style={{ fontSize: "13.5px", color: colors.text, margin: 0, lineHeight: 1.55, fontFamily: fonts.body }}>
            {order.recipientMessage}
          </p>
        </div>
      )}

      {delivered && (
        <div style={{ marginTop: "12px" }}>
          <Timeline order={order} />
        </div>
      )}

      <div style={{ ...surfaces.card, padding: "15px", marginTop: "10px" }}>
        <p style={{
          fontSize: "10.5px", fontWeight: 700, color: colors.textTertiary, margin: "0 0 9px",
          textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.caption,
        }}>Details</p>
        {[
          { label: "Gift", value: order.itemSnapshot?.name },
          { label: "Partner", value: order.partnerSnapshot?.name },
          { label: "Location", value: order.countrySnapshot?.name || order.countryCode },
          { label: "Given", value: formatDate(order.createdAt) },
          { label: "You paid", value: formatUsd(order.totalCharged), accent: true },
          { label: "Order", value: orderId, mono: true },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: colors.textTertiary, fontFamily: fonts.ui, flexShrink: 0 }}>{row.label}</span>
            <span style={{
              fontSize: "12px", fontWeight: 600, textAlign: "right",
              color: row.accent ? colors.accent : colors.text,
              fontFamily: row.mono ? fonts.mono : fonts.ui,
            }}>{row.value || "--"}</span>
          </div>
        ))}
      </div>

      {showQr && (
        <div style={{ ...surfaces.card, padding: "16px", marginTop: "10px", textAlign: "center" }}>
          <QRCode data={`${window.location.origin}/orders/${orderId}`} size={140} />
          <p style={{ fontSize: "10.5px", color: colors.textTertiary, margin: "10px 0 0", fontFamily: fonts.ui }}>
            Scan to open this tracking page
          </p>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "20px" }}>
        <Btn onClick={() => navigate(complete ? "/impact" : "/give")}>
          {complete ? "View all impact" : "Give again"}
        </Btn>
      </div>
    </div>
  );
}
