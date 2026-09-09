import { useEffect, useState } from "react";
import { orgApi } from "../api";
import { colors, fonts, radius, surfaces } from "../../theme";
import { Icon } from "../../icons";
import {
  AiVerdict, Banner, Button, Card, Field, H1, Label, Muted, Spinner, money,
} from "../components";

/**
 * The decision screen.
 *
 * Deliberately shows the evidence before the buttons: the handover photo, the
 * receipt, what was ordered, what was spent, and what the automatic check
 * thought. Approving here is what grants the badge the donor sees, so it
 * should feel like a judgement, not a formality.
 */
export default function Review({ orderId, onDone, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [confirmReject, setConfirmReject] = useState(false);

  useEffect(() => {
    let alive = true;
    orgApi.reviewDetail(orderId)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [orderId]);

  async function decide(decision) {
    setBusy(decision);
    setError(null);
    try {
      await orgApi.review(orderId, decision, note.trim() || null);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  if (error && !data) {
    return (
      <div>
        <Button variant="quiet" onClick={onBack} style={{ padding: "6px 0", marginBottom: "12px" }}>Back to gifts</Button>
        <Banner tone="error">{error}</Banner>
      </div>
    );
  }
  if (!data) return <Spinner label="Loading the delivery" />;

  const overBudget = data.purchase?.overBudget;

  return (
    <div style={{ maxWidth: "620px" }}>
      <Button variant="quiet" onClick={onBack} style={{ padding: "6px 0", marginBottom: "10px" }}>
        Back to gifts
      </Button>

      <H1>Review this delivery</H1>
      <Muted style={{ marginBottom: "18px" }}>
        {data.item}
        {data.recipient?.firstName ? ` for ${data.recipient.firstName}` : ""}
        {data.recipient?.area ? `, ${data.recipient.area}` : ""}
        {data.relay ? ` · delivered by ${data.relay}` : ""}
      </Muted>

      {error && <Banner tone="error">{error}</Banner>}

      <Card style={{ marginBottom: "12px" }}>
        <Label>Handover photo</Label>
        <div style={{ height: "10px" }} />
        {data.proofUrl ? (
          <a href={data.proofUrl} target="_blank" rel="noreferrer">
            <img src={data.proofUrl} alt="Handover" style={{
              width: "100%", borderRadius: radius.md, display: "block",
            }} />
          </a>
        ) : (
          <Muted>No photo was submitted.</Muted>
        )}
      </Card>

      <div style={{ marginBottom: "12px" }}>
        <AiVerdict ai={data.verification?.ai} />
      </div>

      <Card style={{ marginBottom: "12px" }}>
        <Label>Purchase</Label>
        <div style={{ height: "10px" }} />
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            {[
              ["Budget for this gift", money(data.giftAmount)],
              ["Relay spent", money(data.purchase?.amountPaidUsdCents)],
              data.purchase && data.purchase.varianceUsdCents !== 0
                ? ["Difference", `${data.purchase.varianceUsdCents > 0 ? "+" : ""}${money(data.purchase.varianceUsdCents)}`]
                : null,
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: "12.5px", color: colors.textSecondary, fontFamily: fonts.ui }}>{k}</span>
                <span style={{
                  fontSize: "12.5px", fontWeight: 700, fontFamily: fonts.ui,
                  color: k === "Difference" && overBudget ? "#B03028" : colors.text,
                }}>{v}</span>
              </div>
            ))}
            {overBudget && (
              <p style={{ fontSize: "11.5px", color: "#B03028", margin: "8px 0 0", fontFamily: fonts.ui, lineHeight: 1.5 }}>
                The relay spent more than the gift budget. Check the receipt before approving.
              </p>
            )}
          </div>
          {data.receiptUrl && (
            <a href={data.receiptUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
              <img src={data.receiptUrl} alt="Receipt" style={{
                width: "130px", height: "130px", objectFit: "cover",
                borderRadius: radius.md, display: "block", border: `1px solid ${colors.border}`,
              }} />
            </a>
          )}
        </div>
      </Card>

      {data.recipientMessage && (
        <Card style={{ marginBottom: "12px" }}>
          <Label>What the recipient said</Label>
          <p style={{
            fontSize: "13.5px", color: colors.text, margin: "10px 0 0",
            lineHeight: 1.55, fontFamily: fonts.body,
          }}>{data.recipientMessage}</p>
          <p style={{ fontSize: "11px", color: colors.textTertiary, margin: "8px 0 0", fontFamily: fonts.ui }}>
            This is shown to the donor if you approve.
          </p>
        </Card>
      )}

      <Card>
        <Label>Your decision</Label>
        <div style={{ height: "10px" }} />
        <Muted style={{ marginBottom: "14px" }}>
          Approving tells the donor their gift was delivered and shows them this photo.
          Rejecting sends it back to {data.relay || "the relay"} for another photo.
        </Muted>

        <Field
          label={confirmReject ? "Why is it being rejected?" : "Note (optional)"}
          value={note}
          onChange={setNote}
          placeholder={confirmReject ? "Tell the relay what to redo" : "Anything worth recording"}
          hint="Kept in the audit trail. A rejection note is shown to the relay."
        />

        {confirmReject ? (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button variant="danger" onClick={() => decide("reject")} disabled={busy || !note.trim()}>
              {busy === "reject" ? "Rejecting..." : "Confirm rejection"}
            </Button>
            <Button variant="quiet" onClick={() => setConfirmReject(false)}>Cancel</Button>
            {!note.trim() && <Muted style={{ alignSelf: "center" }}>A reason is required.</Muted>}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button onClick={() => decide("approve")} disabled={!!busy || !data.proofUrl}>
              {busy === "approve" ? "Approving..." : "Approve delivery"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReject(true)} disabled={!!busy}>
              Reject
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
