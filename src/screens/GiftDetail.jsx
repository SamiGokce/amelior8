import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGiftItem, usePartners } from "../hooks/useCatalog";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { formatDeliveryWindow, formatUsd } from "../lib/format";
import { colors, fonts, glass } from "../theme";
import { Icon } from "../icons";
import { Header } from "../components/Header";
import { Btn } from "../components/Btn";
import { ErrorState, Loading } from "../components/States";

export default function GiftDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { item, loading } = useGiftItem(itemId);
  const { data: partners } = usePartners();

  const [mode, setMode] = useState("payment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (loading) return <Loading label="Loading gift" />;
  if (!item) {
    return <ErrorState
      title="Gift not found"
      message="This gift is no longer listed."
      onRetry={() => navigate("/give")}
      retryLabel="Browse gifts"
    />;
  }

  const partner = partners.find((p) => p.partnerId === item.partnerId || p.id === item.partnerId);
  const total = item.priceUsdCents + item.facilitatorFeeUsdCents + item.platformFeeUsdCents;

  async function give() {
    if (!user) {
      navigate("/signin", { state: { from: `/gift/${itemId}` } });
      return;
    }
    if (!user.emailVerified) {
      navigate("/verify-email");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // The server recomputes the price from Firestore — nothing about the
      // amount is sent from here.
      const { checkoutUrl } = await api.createCheckoutSession(itemId, { mode });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const breakdown = [
    { label: "Gift", value: item.priceUsdCents },
    { label: "Delivery by a local GR8", value: item.facilitatorFeeUsdCents },
    { label: "Amelior8 platform fee", value: item.platformFeeUsdCents },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Your gift" onBack={() => navigate(-1)} />

      <h1 style={{ fontFamily: fonts.display, fontSize: "20px", fontWeight: 700, color: colors.text, margin: "0 0 6px", letterSpacing: "-0.04em" }}>
        {item.name}
      </h1>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 14px", lineHeight: 1.5, fontFamily: fonts.body }}>
        {item.description}
      </p>

      <div style={{ ...glass.panel, padding: "14px", marginBottom: "10px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: colors.textSecondary, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.caption }}>
          What you pay
        </p>
        {breakdown.map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.body }}>{row.label}</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: colors.text, fontFamily: fonts.ui }}>{formatUsd(row.value)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: "6px", borderTop: `1px solid ${colors.divider}` }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>Total</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: colors.accent, fontFamily: fonts.ui }}>{formatUsd(total)}</span>
        </div>
      </div>

      <div style={{ ...glass.panelLight, padding: "12px", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          {Icon.shield(14, colors.dustyTeal)}
          <span style={{ fontSize: "12px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>{partner?.name || "Local partner"}</span>
        </div>
        <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.body }}>
          Funds for this gift go to {partner?.name || "the partner organisation"}
          {partner?.location ? ` in ${partner.location}` : ""}. {formatDeliveryWindow(item.estimatedDeliveryDays)}.
        </p>
      </div>

      {/* Give once or monthly. The price is the same either way. */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {[
          { key: "payment", label: "Give once" },
          { key: "subscription", label: "Monthly" },
        ].map((opt) => (
          <div
            key={opt.key}
            onClick={() => setMode(opt.key)}
            style={{
              flex: 1, padding: "10px", borderRadius: "14px", textAlign: "center",
              cursor: "pointer", fontFamily: fonts.ui, fontSize: "12px", fontWeight: 700,
              background: mode === opt.key ? colors.accentLight : "rgba(240, 235, 225, 0.4)",
              border: `1px solid ${mode === opt.key ? "rgba(204, 86, 2, 0.3)" : colors.divider}`,
              color: mode === opt.key ? colors.accent : colors.textSecondary,
            }}
          >{opt.label}</div>
        ))}
      </div>

      {error && (
        <div style={{ ...glass.panelAccent, padding: "10px 12px", marginBottom: "10px" }}>
          <p style={{ fontSize: "12px", color: colors.accent, margin: 0, fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "10px" }}>
        <Btn onClick={give} disabled={busy || item.available === false} style={{ width: "100%" }}>
          {busy ? "Opening checkout..." : `Give ${formatUsd(total)}${mode === "subscription" ? " monthly" : ""}`}
        </Btn>
        <p style={{ fontSize: "10px", color: colors.textTertiary, margin: "10px 0 0", textAlign: "center", lineHeight: 1.5, fontFamily: fonts.body }}>
          This is a gift purchase, not a tax-deductible donation.
        </p>
      </div>
    </div>
  );
}
