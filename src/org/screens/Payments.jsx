import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api";
import { useOrgAuth } from "../useOrgAuth";
import { colors, fonts, radius } from "../../theme";
import { Icon } from "../../icons";
import { Banner, Button, Card, H1, Label, Muted, Spinner, money, when } from "../components";

/**
 * Stripe Connect onboarding and monthly reconciliation.
 *
 * Until onboarding completes, donors cannot fund gifts for this organisation
 * at all — checkout refuses to create an order against a partner who cannot
 * receive the money. The screen leads with that consequence rather than
 * burying it.
 */
export default function Payments() {
  const { isAdmin, profile } = useOrgAuth();
  const [stripe, setStripe] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        isAdmin ? orgApi.stripeStatus() : Promise.resolve(null),
        orgApi.payouts(),
      ]);
      if (s) setStripe(s.stripe);
      setPayouts(p.payouts);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function onboard() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await orgApi.startStripeOnboarding();
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const live = stripe?.onboardingComplete;

  return (
    <div style={{ maxWidth: "680px" }}>
      <H1>Payments</H1>
      <Muted style={{ marginBottom: "18px" }}>
        Donations for {profile?.org?.name || "your organisation"} are paid straight
        into your own Stripe account. Amelior8 never holds your money.
      </Muted>

      {error && <Banner tone="error">{error}</Banner>}

      {isAdmin ? (
        <Card style={{ marginBottom: "12px" }}>
          <Label>Stripe account</Label>
          <div style={{ height: "12px" }} />

          {stripe === null ? <Muted>Checking</Muted> : live ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                {Icon.check(17, "#3D6B47")}
                <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#3D6B47", fontFamily: fonts.ui }}>
                  Connected and able to receive donations
                </span>
              </div>
              <Muted>
                Gift money and your half of the verification fee settle into your
                Stripe account as each donation is made.
              </Muted>
            </>
          ) : (
            <>
              <Banner tone="warn">
                Until this is finished, donors cannot give to your gifts. Checkout
                refuses any order your organisation could not be paid for.
              </Banner>

              {stripe?.hasAccount && (
                <div style={{ marginBottom: "14px" }}>
                  {[
                    ["Details submitted", stripe.detailsSubmitted],
                    ["Can accept payments", stripe.chargesEnabled],
                    ["Can receive payouts", stripe.payoutsEnabled],
                  ].map(([label, ok]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0" }}>
                      <span style={{
                        width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                        background: ok ? "rgba(90,138,100,0.18)" : colors.surfaceMuted,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{ok ? Icon.check(10, "#3D6B47") : null}</span>
                      <span style={{
                        fontSize: "13px", fontFamily: fonts.ui,
                        color: ok ? colors.text : colors.textSecondary,
                      }}>{label}</span>
                    </div>
                  ))}

                  {stripe.currentlyDue?.length > 0 && (
                    <Muted style={{ marginTop: "10px", fontSize: "12px" }}>
                      Stripe still needs: {stripe.currentlyDue.join(", ")}
                    </Muted>
                  )}
                </div>
              )}

              <Button onClick={onboard} disabled={busy}>
                {busy ? "Opening Stripe..."
                  : stripe?.hasAccount ? "Continue with Stripe" : "Set up payments with Stripe"}
              </Button>
              <Muted style={{ marginTop: "10px", fontSize: "12px" }}>
                Stripe handles the account, identity checks and bank details directly.
                Amelior8 never sees them.
              </Muted>
            </>
          )}
        </Card>
      ) : (
        <Banner>Only an organisation admin can set up payments.</Banner>
      )}

      <Card>
        <Label>Monthly statements</Label>
        <div style={{ height: "10px" }} />
        <Muted style={{ marginBottom: "14px" }}>
          What your completed deliveries earned from the verification fee. Gift
          money is separate — it reaches you per donation, as it is given.
        </Muted>

        {payouts === null ? <Spinner label="Loading statements" />
          : payouts.length === 0 ? (
            <Muted>No statements yet. They appear once deliveries are verified.</Muted>
          ) : payouts.map((p) => (
            <div key={p.payoutId} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 0", borderTop: `1px solid ${colors.divider}`, gap: "12px",
            }}>
              <div>
                <p style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text, margin: 0, fontFamily: fonts.ui }}>
                  {p.period}
                </p>
                <Muted style={{ fontSize: "12px" }}>
                  {p.deliveryCount} verified {p.deliveryCount === 1 ? "delivery" : "deliveries"}
                  {" · "}{money(p.giftTotalUsdCents)} in gifts
                </Muted>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "14.5px", fontWeight: 700, color: colors.text, margin: 0, fontFamily: fonts.ui }}>
                  {money(p.amountUsdCents)}
                </p>
                <span style={{
                  fontSize: "10.5px", fontWeight: 700, fontFamily: fonts.caption,
                  color: p.status === "paid" ? "#3D6B47" : colors.textTertiary,
                }}>{p.status}</span>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}
