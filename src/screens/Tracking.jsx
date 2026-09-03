import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "../hooks/useOrder";
import { api } from "../lib/api";
import { formatDate, formatDateTime, formatUsd, toDate } from "../lib/format";
import { STATUS, stageStates, statusExplanation } from "../../shared/orderStatus";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Header } from "../components/Header";
import { Btn } from "../components/Btn";
import { QRCode } from "../components/QRCode";
import { ErrorState, Loading } from "../components/States";

/** The verification badge only ever says what is actually true. */
function ProofBadge({ verification }) {
  const state = verification?.state || "none";

  const config = {
    passed: { label: "AI Verified", color: colors.successText, bg: "rgba(90, 138, 100, 0.15)", icon: "check" },
    overridden: { label: "Verified", color: colors.successText, bg: "rgba(90, 138, 100, 0.15)", icon: "check" },
    pending: { label: "Verification in review", color: colors.oliveDrab, bg: "rgba(107, 107, 82, 0.12)", icon: "cpu" },
    flagged: { label: "Verification in review", color: colors.oliveDrab, bg: "rgba(107, 107, 82, 0.12)", icon: "cpu" },
    failed: { label: "Verification in review", color: colors.oliveDrab, bg: "rgba(107, 107, 82, 0.12)", icon: "cpu" },
  }[state];

  if (!config) return null;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      background: config.bg, borderRadius: "20px", padding: "5px 10px",
    }}>
      {Icon[config.icon](13, config.color)}
      <span style={{ fontSize: "10px", fontWeight: 700, color: config.color, fontFamily: fonts.caption, letterSpacing: "0.03em" }}>
        {config.label}
      </span>
    </div>
  );
}

function ProofPhoto({ orderId, verification }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getProofUrl(orderId)
      .then((res) => { if (alive) setUrl(res.url); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [orderId]);

  return (
    <div style={{ ...glass.panel, padding: "12px", marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: colors.textSecondary, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.caption }}>
          Delivery photo
        </p>
        <ProofBadge verification={verification} />
      </div>

      {url ? (
        <img
          src={url}
          alt="Delivery of your gift"
          style={{ width: "100%", borderRadius: "12px", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "140px", borderRadius: "12px",
          background: "rgba(107, 107, 82, 0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
            {failed ? "Photo could not be loaded" : "Loading photo"}
          </p>
        </div>
      )}
    </div>
  );
}

function Timeline({ order }) {
  const stages = stageStates(order);

  return (
    <div style={{ ...glass.panel, padding: "16px", marginBottom: "10px" }}>
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const done = stage.state === "complete";
        const current = stage.state === "current";
        const dotColor = done ? colors.success : current ? colors.accent : "rgba(107, 107, 82, 0.2)";

        return (
          <div key={stage.key} style={{ display: "flex", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                background: done ? "rgba(90, 138, 100, 0.18)" : current ? colors.accentLight : "transparent",
                border: `2px solid ${dotColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {done && Icon.check(11, colors.successText)}
              </div>
              {!isLast && (
                <div style={{
                  width: "2px", flex: 1, minHeight: "26px",
                  background: done ? colors.success : "rgba(107, 107, 82, 0.15)",
                }} />
              )}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : "14px", flex: 1 }}>
              <p style={{
                fontSize: "13px", margin: "1px 0 2px", fontFamily: fonts.ui,
                fontWeight: done || current ? 700 : 600,
                color: done || current ? colors.text : colors.textTertiary,
              }}>{stage.label}</p>
              <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.body }}>
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

  // A rules denial and a genuinely missing order look the same on purpose —
  // one donor must not be able to probe for another's order ids.
  if (error || !order) {
    return <ErrorState
      title="Gift not found"
      message="We could not find that gift on your account."
      onRetry={() => navigate("/orders")}
      retryLabel="Your gifts"
    />;
  }

  const eta = toDate(order.estimatedDeliveryAt);
  const showProof = !!order.proofPhotoPath;
  const trackingUrl = `${window.location.origin}/orders/${orderId}`;

  const details = [
    { label: "Gift", value: order.itemSnapshot?.name },
    { label: "Partner", value: order.partnerSnapshot?.name },
    { label: "Location", value: order.countrySnapshot?.name || order.countryCode },
    { label: "Given", value: formatDate(order.createdAt) },
    { label: "You paid", value: formatUsd(order.totalCharged), accent: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Your gift" onBack={() => navigate("/orders")} />

      {/* Honest status line — never a bare spinner, whatever stage it sits at. */}
      <div style={{ ...glass.panelLight, padding: "12px", marginBottom: "10px" }}>
        <p style={{ fontSize: "12px", color: colors.text, margin: 0, lineHeight: 1.5, fontFamily: fonts.body }}>
          {statusExplanation(order)}
        </p>
        {eta && order.status !== STATUS.VERIFIED && order.status !== STATUS.REFUNDED && (
          <p style={{ fontSize: "11px", color: colors.textSecondary, margin: "6px 0 0", fontFamily: fonts.caption, fontWeight: 600 }}>
            Expected by {formatDate(eta)}
          </p>
        )}
      </div>

      <Timeline order={order} />

      {order.facilitatorSnapshot && (
        <div style={{ ...glass.panel, padding: "12px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
          {order.facilitatorSnapshot.photoUrl ? (
            <img
              src={order.facilitatorSnapshot.photoUrl}
              alt=""
              style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
              background: colors.accentLight, display: "flex", alignItems: "center", justifyContent: "center",
            }}>{Icon.user(18, colors.accent)}</div>
          )}
          <div>
            <p style={{ fontSize: "10px", color: colors.textSecondary, margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontFamily: fonts.caption }}>
              Delivered by
            </p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: colors.text, margin: 0, fontFamily: fonts.ui }}>
              {order.facilitatorSnapshot.name}
            </p>
          </div>
        </div>
      )}

      {showProof && <ProofPhoto orderId={orderId} verification={order.verification} />}

      <div style={{ ...glass.panel, padding: "14px", marginBottom: "10px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: colors.textSecondary, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.caption }}>
          Details
        </p>
        {details.map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.body, flexShrink: 0 }}>{row.label}</span>
            <span style={{
              fontSize: "12px", fontWeight: 600, textAlign: "right",
              color: row.accent ? colors.accent : colors.text, fontFamily: fonts.ui,
            }}>{row.value || "--"}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
          <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.body }}>Order</span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: colors.text, fontFamily: fonts.mono }}>{orderId}</span>
        </div>
      </div>

      {showQr && (
        <div style={{ ...glass.panel, padding: "16px", marginBottom: "10px", textAlign: "center" }}>
          <QRCode data={trackingUrl} size={140} />
          <p style={{ fontSize: "10px", color: colors.textSecondary, margin: "10px 0 0", fontFamily: fonts.body }}>
            Scan to open this tracking page
          </p>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "10px", display: "flex", gap: "8px" }}>
        <Btn onClick={() => setShowQr((v) => !v)} primary={false} style={{ flex: 1 }}>
          {showQr ? "Hide code" : "Share"}
        </Btn>
        <Btn onClick={() => navigate("/give")} style={{ flex: 1 }}>Give again</Btn>
      </div>
    </div>
  );
}
