import { Resend } from "resend";
import { adminDb } from "./admin.js";
import { STATUS } from "../../shared/orderStatus.js";

const FROM = process.env.EMAIL_FROM || "Amelior8 <gifts@amelior8.com>";
const BASE = () => process.env.APP_BASE_URL || "https://amelior8.com";

// Brand palette (BRAND.md). Inline styles — email clients strip stylesheets.
const C = {
  orange: "#CC5602",
  cloud: "#F0EBE1",
  charcoal: "#2C2C2A",
  olive: "#6B6B52",
};

let client = null;
function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

function money(cents) {
  if (cents === null || cents === undefined) return "--";
  const d = cents / 100;
  return d % 1 === 0 ? `$${d.toFixed(0)}` : `$${d.toFixed(2)}`;
}

function layout({ heading, body, cta, ctaUrl }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.cloud};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cloud};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;padding:32px;">
<tr><td>
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${C.orange};letter-spacing:-0.05em;">Amelior8</p>
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:${C.charcoal};letter-spacing:-0.03em;">${heading}</h1>
<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${C.charcoal};">${body}</div>
${cta ? `<p style="margin:28px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:${C.orange};color:${C.cloud};text-decoration:none;padding:13px 24px;border-radius:14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;">${cta}</a></p>` : ""}
<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid rgba(107,107,82,0.15);font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${C.olive};">
Amelior8 connects you with local partners who deliver your gift in person. Your gift goes in full to the partner organisation named above; the delivery fee pays the relay who hands it over and the check that verifies it.
</p>
</td></tr></table></td></tr></table></body></html>`;
}

function receiptRows(order) {
  // The same two lines the donor saw at checkout. Never blended.
  const rows = [
    ["Your gift", money(order.giftAmount)],
    ["Verified delivery", money(order.verificationFee)],
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${C.charcoal};">
${rows.map(([l, v]) => `<tr><td style="padding:6px 0;color:${C.olive};">${l}</td><td align="right" style="padding:6px 0;">${v}</td></tr>`).join("")}
<tr><td style="padding:10px 0 0;border-top:1px solid rgba(107,107,82,0.15);font-weight:700;">Total charged</td><td align="right" style="padding:10px 0 0;border-top:1px solid rgba(107,107,82,0.15);font-weight:700;">${money(order.totalCharged)}</td></tr>
</table>`;
}

function template(type, order) {
  const item = order.itemSnapshot?.name || "your gift";
  const partner = order.partnerSnapshot?.name || "our local partner";
  const country = order.countrySnapshot?.name || order.countryCode || "";
  const url = `${BASE()}/orders/${order.id || order.orderId}`;
  const relayName = order.relaySnapshot?.name?.split(" ")[0] || "A relay";

  switch (type) {
    case STATUS.FUNDED:
      return {
        subject: `Your gift is confirmed — ${item}`,
        html: layout({
          heading: "Your gift is confirmed",
          body: `<p style="margin:0 0 4px;">Thank you. You have given <strong>${item}</strong> in ${country}.</p>
<p style="margin:0;">Funds go to <strong>${partner}</strong>, who will source the gift. A vetted local relay will buy it and hand it over in person, and you will get a photo when they do.</p>
${receiptRows(order)}
<p style="margin:0;">Order <strong>${order.id || order.orderId}</strong></p>`,
          cta: "Track your gift",
          ctaUrl: url,
        }),
      };

    case STATUS.ASSIGNED:
      return {
        subject: `${relayName} is delivering your gift`,
        html: layout({
          heading: "A relay has been assigned",
          body: `<p style="margin:0 0 12px;"><strong>${relayName}</strong> will buy and deliver <strong>${item}</strong> in ${country}.</p>
<p style="margin:0;">You will hear from us again when the gift has been bought.</p>`,
          cta: "Track your gift",
          ctaUrl: url,
        }),
      };

    case STATUS.PURCHASED:
      return {
        subject: `Your gift has been bought`,
        html: layout({
          heading: "The gift has been bought",
          body: `<p style="margin:0;"><strong>${relayName}</strong> has purchased <strong>${item}</strong> and is arranging the handover.</p>`,
          cta: "Track your gift",
          ctaUrl: url,
        }),
      };

    case STATUS.VERIFIED:
      return {
        subject: `Delivered — ${item}`,
        html: layout({
          heading: "Your gift was delivered",
          body: `<p style="margin:0 0 12px;"><strong>${item}</strong> reached its recipient in ${country}, delivered by ${relayName}.</p>
<p style="margin:0;">The delivery photo is on your tracking page.</p>`,
          cta: "See the proof",
          ctaUrl: url,
        }),
      };

    case STATUS.PROOF_REJECTED:
      return {
        subject: `An update on your gift`,
        html: layout({
          heading: "We are re-checking the delivery",
          body: `<p style="margin:0 0 12px;">The delivery photo for <strong>${item}</strong> did not pass our verification check, so we have asked the relay for another one.</p>
<p style="margin:0;">This is a routine check and often just means an unclear photo. We will confirm as soon as it clears.</p>`,
          cta: "Track your gift",
          ctaUrl: url,
        }),
      };

    case STATUS.REFUNDED:
      return {
        subject: `Your gift has been refunded`,
        html: layout({
          heading: "Refunded in full",
          body: `<p style="margin:0 0 12px;">We could not complete <strong>${item}</strong>, so we have refunded <strong>${money(order.totalCharged)}</strong> to your original payment method.</p>
<p style="margin:0;">It usually appears within 5 to 10 business days.</p>`,
          cta: "Give again",
          ctaUrl: BASE(),
        }),
      };

    default:
      return null;
  }
}

/**
 * Sends one transactional email, at most once per order per type.
 *
 * Dedup is a create-only doc at orders/{id}/emails/{type}: Stripe retries
 * webhooks, and a donor must never get the same confirmation twice.
 */
export async function sendOrderEmail(type, order) {
  const orderId = order.id || order.orderId;
  if (!orderId || !order.donorEmail) return { sent: false, reason: "missing_recipient" };

  const content = template(type, order);
  if (!content) return { sent: false, reason: "no_template" };

  const marker = adminDb()
    .collection("orders").doc(orderId)
    .collection("emails").doc(type);

  try {
    await marker.create({ type, to: order.donorEmail, sentAt: new Date() });
  } catch {
    // Already exists — this is a retry.
    return { sent: false, reason: "already_sent" };
  }

  const mailer = resend();
  if (!mailer) {
    console.warn(`RESEND_API_KEY not set — skipping "${type}" email for ${orderId}`);
    await marker.set({ skipped: true, reason: "no_api_key" }, { merge: true });
    return { sent: false, reason: "not_configured" };
  }

  try {
    await mailer.emails.send({
      from: FROM,
      to: order.donorEmail,
      subject: content.subject,
      html: content.html,
    });
    return { sent: true };
  } catch (err) {
    // Roll the marker back so a later retry can try again.
    console.error(`Failed to send "${type}" email for ${orderId}:`, err);
    await marker.delete().catch(() => {});
    return { sent: false, reason: "send_failed" };
  }
}
