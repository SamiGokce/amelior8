import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGiftItem, usePartners, CATEGORY_META } from "../hooks/useCatalog";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { formatDeliveryWindow, formatUsd } from "../lib/format";
import { VERIFICATION_FEE_USD_CENTS, priceBreakdown } from "../../shared/fees";
import { colors, fonts, radius, surfaces } from "../theme";
import { Icon, renderIcon } from "../icons";
import { Header } from "../components/Header";
import { Btn, Chip, IconButton } from "../components/Btn";
import { ErrorState, Loading } from "../components/States";

// The catalog prices each gift, so the chips pick how many to send rather than
// a free amount. Totals shown are the real charge for that quantity.
const QUANTITIES = [1, 2, 3, 5];

function InfoTile({ icon, iconColor, iconBg, value, label }) {
  return (
    <div style={{
      flex: 1, ...surfaces.tile, padding: "12px 10px", minWidth: 0,
    }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "9px", background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "9px",
      }}>{renderIcon(icon, 15, iconColor)}</div>
      <p style={{
        fontSize: "13px", fontWeight: 700, color: colors.text, margin: "0 0 2px",
        fontFamily: fonts.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</p>
      <p style={{ fontSize: "10.5px", color: colors.textTertiary, margin: 0, fontFamily: fonts.ui }}>
        {label}
      </p>
    </div>
  );
}

export default function GiftDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { item, loading } = useGiftItem(itemId);
  const { data: partners } = usePartners();

  const [quantity, setQuantity] = useState(1);
  const [monthly, setMonthly] = useState(false);
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
  const meta = CATEGORY_META[item.category] || {};

  // The same function the server uses to price the order, so the donor is
  // never quoted a number the server then disagrees with.
  const price = priceBreakdown(item, quantity);
  const unit = item.priceUsdCents;
  const total = price.totalCharged;

  async function give() {
    if (!user) return navigate("/signin", { state: { from: `/gift/${itemId}` } });
    if (!user.emailVerified) return navigate("/verify-email");

    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.createCheckoutSession(itemId, {
        mode: monthly ? "subscription" : "payment",
        quantity,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Header
        onBack={() => navigate(-1)}
        actions={<>
          <IconButton icon="heart" size={40} color={colors.text} />
          <IconButton icon="share" size={40} color={colors.text} />
        </>}
      />

      {/* Hero. A gift without a photo gets a tinted category panel rather than
          a stock image of somebody else's delivery. */}
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          style={{ width: "100%", borderRadius: radius.xl, display: "block", aspectRatio: "4/3", objectFit: "cover" }}
        />
      ) : (
        <div style={{
          width: "100%", aspectRatio: "4/3", borderRadius: radius.xl,
          background: `${meta.color || colors.accent}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{renderIcon(meta.icon || "gift", 52, meta.color || colors.accent)}</div>
      )}

      <h1 style={{
        fontFamily: fonts.display, fontSize: "23px", fontWeight: 700, color: colors.text,
        margin: "18px 0 5px", letterSpacing: "-0.04em", lineHeight: 1.15,
      }}>{item.name}</h1>
      <p style={{ fontSize: "13.5px", color: colors.textSecondary, margin: "0 0 16px", lineHeight: 1.5, fontFamily: fonts.body }}>
        {item.description}
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <InfoTile
          icon="heart" iconColor={colors.accent} iconBg={colors.accentLight}
          value={formatUsd(unit)} label="Gift"
        />
        <InfoTile
          icon="user" iconColor={colors.textSecondary} iconBg="rgba(107, 107, 82, 0.12)"
          value="Local" label="Relay"
        />
        <InfoTile
          icon="video" iconColor={colors.categoryWater} iconBg="rgba(59, 147, 224, 0.12)"
          value="Photo" label="You receive"
        />
      </div>

      <p style={{
        fontSize: "14px", fontWeight: 700, color: colors.text,
        margin: "0 0 11px", fontFamily: fonts.ui, letterSpacing: "-0.01em",
      }}>Choose amount</p>

      <div style={{ display: "flex", gap: "7px", marginBottom: "12px" }}>
        {QUANTITIES.map((q) => (
          <Chip key={q} selected={quantity === q} onClick={() => setQuantity(q)} style={{ flex: 1, padding: "11px 6px" }}>
            {formatUsd(unit * q)}
          </Chip>
        ))}
        <Chip
          selected={!QUANTITIES.includes(quantity)}
          onClick={() => {
            const input = window.prompt("How many would you like to send? (1 to 10)", String(quantity));
            const n = Math.max(1, Math.min(10, parseInt(input, 10) || 0));
            if (n) setQuantity(n);
          }}
          style={{ flex: 1, padding: "11px 6px" }}
        >Other</Chip>
      </div>

      <div style={{ display: "flex", gap: "7px", marginBottom: "16px" }}>
        <Chip selected={!monthly} onClick={() => setMonthly(false)} style={{ flex: 1 }}>Give once</Chip>
        <Chip selected={monthly} onClick={() => setMonthly(true)} style={{ flex: 1 }}>Monthly</Chip>
      </div>

      {/* Two lines, deliberately. The gift and the fee are never blended into
          a single number — a donor should always see exactly what reaches the
          partner and what pays for the verification. */}
      <div style={{ ...surfaces.card, padding: "14px", marginBottom: "10px" }}>
        {[
          { label: quantity > 1 ? `Your gift (x${quantity})` : "Your gift", value: price.giftAmount },
          { label: "Verified delivery", value: price.verificationFee },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span style={{ fontSize: "13px", color: colors.textSecondary, fontFamily: fonts.ui }}>{row.label}</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: colors.text, fontFamily: fonts.ui }}>
              {formatUsd(row.value)}
            </span>
          </div>
        ))}
        <div style={{
          display: "flex", justifyContent: "space-between", padding: "9px 0 0",
          marginTop: "5px", borderTop: `1px solid ${colors.divider}`,
        }}>
          <span style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>Total</span>
          <span style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>
            {formatUsd(total)}{monthly ? " / month" : ""}
          </span>
        </div>
        <p style={{
          fontSize: "11px", color: colors.textTertiary, margin: "9px 0 0",
          lineHeight: 1.5, fontFamily: fonts.ui,
        }}>
          Every cent of your gift goes to {partner?.name || "the partner organisation"}.
          The delivery fee pays the relay who buys and hands it over, and the check
          that verifies it happened.
        </p>
      </div>

      <div style={{ ...surfaces.tile, padding: "13px", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
          {Icon.shield(14, colors.dustyTeal)}
          <span style={{ fontSize: "12.5px", fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>
            {partner?.name || "Local partner"}
          </span>
        </div>
        <p style={{ fontSize: "11.5px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.body }}>
          {partner?.name || "The partner organisation"}
          {partner?.location ? ` in ${partner.location}` : ""} sources and delivers this gift.
          {" "}{formatDeliveryWindow(item.estimatedDeliveryDays)}.
        </p>
      </div>

      {error && (
        <div style={{ ...surfaces.accent, padding: "11px 13px", marginBottom: "8px" }}>
          <p style={{ fontSize: "12px", color: colors.accent, margin: 0, fontWeight: 600, fontFamily: fonts.ui }}>{error}</p>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "12px" }}>
        <Btn onClick={give} disabled={busy || item.available === false}>
          {busy ? "Opening checkout" : `Continue — ${formatUsd(total)}${monthly ? "/mo" : ""}`}
        </Btn>
        <p style={{
          fontSize: "10px", color: colors.textTertiary, margin: "10px 0 0",
          textAlign: "center", lineHeight: 1.5, fontFamily: fonts.ui,
        }}>
          This is a gift purchase, not a tax-deductible donation.
        </p>
      </div>
    </div>
  );
}
