import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrder } from "../hooks/useOrder";
import { STATUS } from "../../shared/orderStatus";
import { colors, fonts, surfaces } from "../theme";
import { Icon } from "../icons";
import { Btn } from "../components/Btn";
import { ErrorState, Loading } from "../components/States";

/**
 * Waits for the Stripe webhook, rather than trusting the redirect.
 *
 * The redirect only means the donor got sent back here — it is not proof of
 * payment. The order flipping to FUNDED is, and that only happens when the
 * signed webhook lands. If the donor closes the tab before this screen loads,
 * the order still funds correctly; this screen is a view, not a step.
 */
export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order");
  const { order, loading } = useOrder(orderId);
  const [waitedSeconds, setWaited] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setWaited((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!orderId) {
    return <ErrorState
      title="No gift to show"
      message="We could not tell which gift this was."
      onRetry={() => navigate("/")}
      retryLabel="Back to home"
    />;
  }

  if (loading || !order) return <Loading label="Confirming your gift" />;

  if (order.status === STATUS.PAYMENT_FAILED) {
    return <ErrorState
      title="Payment did not go through"
      message="Nothing was charged. You can try again whenever you like."
      onRetry={() => navigate(`/gift/${order.itemId}`)}
      retryLabel="Try again"
    />;
  }

  const funded = order.status !== STATUS.PENDING_PAYMENT;

  if (!funded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <Loading label="Confirming your payment" />
        {waitedSeconds > 12 && (
          <div style={{ ...surfaces.cardFlat, padding: "12px", margin: "0 0 12px" }}>
            <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.body }}>
              This is taking longer than usual. Your payment is safe — the confirmation
              just has not reached us yet. You can close this page; we will email you
              as soon as it clears.
            </p>
          </div>
        )}
        <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.mono }}>{orderId}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{
        width: "72px", height: "72px", borderRadius: "50%",
        background: "rgba(90, 138, 100, 0.15)", border: "1px solid rgba(90, 138, 100, 0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px",
      }}>{Icon.check(32, colors.successText)}</div>

      <h1 style={{ fontFamily: fonts.display, fontSize: "22px", fontWeight: 700, color: colors.text, margin: "0 0 8px", letterSpacing: "-0.04em" }}>
        Your gift is confirmed
      </h1>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 6px", lineHeight: 1.5, fontFamily: fonts.body, padding: "0 6px" }}>
        {order.itemSnapshot?.name} for a recipient in {order.countrySnapshot?.name || order.countryCode},
        through {order.partnerSnapshot?.name}.
      </p>
      <p style={{ fontSize: "11px", color: colors.textTertiary, margin: "0 0 24px", fontFamily: fonts.mono }}>{orderId}</p>

      <Btn onClick={() => navigate(`/orders/${orderId}`)} style={{ width: "100%", marginBottom: "10px" }}>
        Track your gift
      </Btn>
      <Btn onClick={() => navigate("/give")} primary={false} style={{ width: "100%" }}>
        Give again
      </Btn>
    </div>
  );
}
