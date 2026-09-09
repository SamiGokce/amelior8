import { useState } from "react";
import { relayApi } from "../api";
import { enqueue } from "../offline";
import { PhotoInput } from "../PhotoInput";
import { colors, fonts, radius, shadow, surfaces } from "../../theme";
import { Icon } from "../../icons";

const money = (c) => (c === null || c === undefined ? "--" : `$${(c / 100).toFixed(2)}`);

function Big({ children, onClick, disabled, variant = "primary" }) {
  const style = variant === "primary"
    ? { background: colors.charcoal, color: "#FFF", boxShadow: shadow.cta }
    : { background: colors.surface, color: colors.text, border: `1px solid ${colors.border}` };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "17px", borderRadius: radius.pill, border: "none",
        fontSize: "16px", fontWeight: 700, fontFamily: fonts.ui,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
        marginBottom: "10px", ...style,
      }}
    >{children}</button>
  );
}

function Note({ tone = "info", children }) {
  const t = {
    info: { bg: colors.surfaceMuted, fg: colors.text },
    warn: { bg: "rgba(204, 86, 2, 0.10)", fg: "#A34602" },
    error: { bg: "rgba(224, 67, 59, 0.10)", fg: "#B03028" },
    ok: { bg: "rgba(90, 138, 100, 0.12)", fg: "#3D6B47" },
  }[tone];
  return (
    <div style={{ background: t.bg, borderRadius: radius.md, padding: "13px 15px", marginBottom: "14px" }}>
      <p style={{ fontSize: "13.5px", color: t.fg, margin: 0, lineHeight: 1.5, fontWeight: 600, fontFamily: fonts.ui }}>
        {children}
      </p>
    </div>
  );
}

/**
 * One job, in whichever state it is in.
 *
 * Both submissions follow the same shape: take a photo, add the one piece of
 * information that matters, send. If sending fails or there is no signal, it
 * goes to the offline queue and the relay is told plainly that it is waiting —
 * never that it is done.
 */
export default function Job({ job, queued, onBack, onChanged }) {
  const [photo, setPhoto] = useState(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [queuedNow, setQueuedNow] = useState(false);

  const pending = queued?.[0];
  const buying = job.status === "ASSIGNED";
  const delivering = job.status === "PURCHASED" || job.status === "PROOF_REJECTED";

  async function submit() {
    setBusy(true);
    setError(null);

    const cents = Math.round(parseFloat(amount) * 100);
    const payload = buying
      ? { kind: "purchase", orderId: job.id, blob: photo.blob, contentType: photo.contentType, amountPaidUsdCents: cents }
      : {
          kind: "deliver", orderId: job.id, blob: photo.blob, contentType: photo.contentType,
          recipientMessage: message.trim() || null, recipientConsent: consent,
        };

    try {
      if (buying) {
        await relayApi.submitPurchase(job.id, {
          blob: photo.blob, contentType: photo.contentType, amountPaidUsdCents: cents,
        });
      } else {
        await relayApi.submitDelivery(job.id, {
          blob: photo.blob,
          contentType: photo.contentType,
          recipientMessage: message.trim() || null,
          recipientConsent: consent,
        });
      }
      onChanged();
      onBack();
    } catch (err) {
      // A rejection on the merits is the relay's to fix now. Anything else —
      // no signal, a server problem — is queued and retried.
      if (err?.isTransient || err?.status === 0) {
        await enqueue(payload);
        setQueuedNow(true);
        onChanged();
      } else {
        setError(err.message);
      }
      setBusy(false);
    }
  }

  const amountValid = !buying || (parseFloat(amount) > 0 && parseFloat(amount) < 100000);
  const overBudget = buying && parseFloat(amount) * 100 > job.budgetUsdCents;

  if (queuedNow) {
    return (
      <div style={{ padding: "22px", fontFamily: fonts.ui }}>
        <Note tone="ok">
          Saved on your phone. It will send by itself when you have signal — you can
          close the app.
        </Note>
        <Big onClick={onBack}>Back to my jobs</Big>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 22px 40px", fontFamily: fonts.ui }}>
      <p onClick={onBack} style={{
        fontSize: "14px", color: colors.textSecondary, margin: "0 0 18px",
        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
      }}>{Icon.arrowLeft(16, colors.textSecondary)} My jobs</p>

      <h1 style={{
        fontFamily: fonts.display, fontSize: "24px", fontWeight: 700, color: colors.text,
        margin: "0 0 6px", letterSpacing: "-0.045em", lineHeight: 1.2,
      }}>{job.item}</h1>
      <p style={{ fontSize: "14px", color: colors.textSecondary, margin: "0 0 18px", lineHeight: 1.5 }}>
        {job.itemDescription}
      </p>

      <div style={{ ...surfaces.card, padding: "15px", marginBottom: "16px" }}>
        {[
          ["For", job.recipient?.firstName ? `${job.recipient.firstName}${job.recipient.area ? `, ${job.recipient.area}` : ""}` : "--"],
          ["You can spend up to", money(job.budgetUsdCents)],
          job.quantity > 1 ? ["How many", String(job.quantity)] : null,
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span style={{ fontSize: "13.5px", color: colors.textSecondary }}>{k}</span>
            <span style={{ fontSize: "13.5px", fontWeight: 700, color: colors.text }}>{v}</span>
          </div>
        ))}
      </div>

      {pending && (
        <Note tone={pending.permanent ? "error" : "warn"}>
          {pending.permanent
            ? `This could not be sent: ${pending.lastError}. Start it again.`
            : "A submission for this job is saved on your phone and waiting for signal."}
        </Note>
      )}

      {job.status === "PROOF_REJECTED" && (
        <Note tone="warn">
          Your organisation asked for another photo.
          {job.rejectionNote ? ` They said: "${job.rejectionNote}"` : ""}
        </Note>
      )}

      {job.status === "DELIVERED" && (
        <Note>Sent. Your organisation is checking it. Nothing more to do.</Note>
      )}

      {error && <Note tone="error">{error}</Note>}

      {buying && !pending && (
        <>
          <PhotoInput
            label="Photo of the receipt"
            hint="If there is no printed receipt, photograph the goods and whatever note you were given."
            value={photo}
            onChange={setPhoto}
          />

          <p style={{
            fontSize: "11px", fontWeight: 700, color: colors.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontFamily: fonts.caption,
          }}>What you actually paid</p>
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <span style={{
              position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)",
              fontSize: "17px", color: colors.textSecondary,
            }}>$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              inputMode="decimal"
              style={{
                width: "100%", boxSizing: "border-box", padding: "16px 18px 16px 34px",
                borderRadius: radius.md, background: colors.surface,
                border: `1px solid ${colors.border}`, fontSize: "17px",
                fontFamily: fonts.ui, color: colors.text, outline: "none",
              }}
            />
          </div>
          {overBudget && (
            <Note tone="warn">
              That is more than the {money(job.budgetUsdCents)} budget. You can still send
              it — your organisation will be asked about the difference.
            </Note>
          )}

          <Big onClick={submit} disabled={busy || !photo || !amountValid}>
            {busy ? "Sending..." : "I bought it"}
          </Big>
        </>
      )}

      {delivering && !pending && (
        <>
          <PhotoInput
            label="Photo of the handover"
            hint="Show the gift with the person receiving it. Faces are blurred before the donor sees it."
            value={photo}
            onChange={setPhoto}
          />

          {/* Consent is its own deliberate act. A photo existing is not
              agreement to be photographed, and the server refuses the
              submission without this. */}
          <div
            onClick={() => setConsent((v) => !v)}
            style={{
              display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer",
              background: consent ? "rgba(90, 138, 100, 0.10)" : colors.surface,
              border: `1px solid ${consent ? "rgba(90, 138, 100, 0.35)" : colors.border}`,
              borderRadius: radius.md, padding: "15px", marginBottom: "18px",
            }}
          >
            <div style={{
              width: "24px", height: "24px", borderRadius: "7px", flexShrink: 0, marginTop: "1px",
              background: consent ? "#3D6B47" : colors.surfaceMuted,
              border: consent ? "none" : `1px solid ${colors.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {consent && Icon.check(15, "#FFFFFF")}
            </div>
            <div>
              <p style={{ fontSize: "14.5px", fontWeight: 700, color: colors.text, margin: "0 0 3px", lineHeight: 1.35 }}>
                They agreed to be photographed
              </p>
              <p style={{ fontSize: "12.5px", color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Ask first. If they would rather not be in the photo, photograph
                the gift on its own — that is fine.
              </p>
            </div>
          </div>

          <p style={{
            fontSize: "11px", fontWeight: 700, color: colors.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontFamily: fonts.caption,
          }}>Anything they said (optional)</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="Only if they want it passed on"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", padding: "14px 16px",
              borderRadius: radius.md, background: colors.surface,
              border: `1px solid ${colors.border}`, fontSize: "15px",
              fontFamily: fonts.ui, color: colors.text, outline: "none",
              resize: "vertical", marginBottom: "18px",
            }}
          />

          <Big onClick={submit} disabled={busy || !photo || !consent}>
            {busy ? "Sending..." : "I delivered it"}
          </Big>
          {photo && !consent && (
            <p style={{
              fontSize: "12.5px", color: colors.textSecondary, margin: "-2px 0 0",
              textAlign: "center", lineHeight: 1.5,
            }}>Confirm they agreed to the photo before sending.</p>
          )}
        </>
      )}
    </div>
  );
}
