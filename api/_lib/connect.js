import { FieldValue, adminDb } from "./admin.js";
import { HttpError } from "./http.js";
import { stripe } from "./stripe.js";

/**
 * Stripe Connect onboarding for partner organisations.
 *
 * Standard accounts: the partner has (or creates) their own Stripe account and
 * Stripe owns the whole onboarding, KYC and dispute experience. Less UI for us
 * to build and less compliance surface to carry, which matters more than
 * onboarding polish for a first cohort of partners.
 *
 * Charges are destination charges: the donor's money settles into the
 * partner's account, minus our application fee. We never hold donor funds.
 */

const ACCOUNT_TYPE = "standard";

/** Ready to receive a donor's money. All three must be true. */
export function isOnboarded(account) {
  return !!(account?.details_submitted && account?.charges_enabled && account?.payouts_enabled);
}

export async function getPartner(partnerId) {
  const snap = await adminDb().collection("partners").doc(partnerId).get();
  if (!snap.exists) throw new HttpError(404, "Organisation not found.", "partner_not_found");
  return { partnerId, ...snap.data() };
}

/**
 * Creates the connected account if the partner has none, then returns a
 * single-use onboarding link. Links expire quickly, so one is minted per
 * request rather than stored.
 */
export async function startOnboarding(partnerId, { returnUrl, refreshUrl }) {
  const partner = await getPartner(partnerId);
  const db = adminDb();
  let accountId = partner.stripeAccountId;

  if (!accountId) {
    const account = await stripe().accounts.create({
      type: ACCOUNT_TYPE,
      country: partner.countryCode || undefined,
      email: partner.contactEmail || undefined,
      business_profile: {
        name: partner.name,
        product_description: "Charitable gift delivery through Amelior8",
      },
      metadata: { partnerId },
    });
    accountId = account.id;

    await db.collection("partners").doc(partnerId).update({
      stripeAccountId: accountId,
      stripeAccountType: ACCOUNT_TYPE,
      onboardingComplete: false,
      onboardingStartedAt: FieldValue.serverTimestamp(),
    });
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  return { accountId, url: link.url, expiresAt: new Date(link.expires_at * 1000) };
}

/**
 * Writes Stripe's view of an account onto the partner.
 *
 * Called both by the `account.updated` webhook and on demand, because a
 * partner returning from onboarding should not have to wait for a webhook to
 * see that they are live.
 */
export async function syncAccountStatus(partnerId, account = null) {
  const partner = await getPartner(partnerId);
  if (!partner.stripeAccountId) {
    return { onboardingComplete: false, reason: "no_account" };
  }

  const acct = account || await stripe().accounts.retrieve(partner.stripeAccountId);
  const complete = isOnboarded(acct);

  await adminDb().collection("partners").doc(partnerId).update({
    onboardingComplete: complete,
    stripeAccountStatus: {
      detailsSubmitted: !!acct.details_submitted,
      chargesEnabled: !!acct.charges_enabled,
      payoutsEnabled: !!acct.payouts_enabled,
      // What Stripe still wants, so the portal can say something specific.
      currentlyDue: acct.requirements?.currently_due || [],
      disabledReason: acct.requirements?.disabled_reason || null,
      syncedAt: FieldValue.serverTimestamp(),
    },
    ...(complete && !partner.onboardingComplete
      ? { onboardingCompletedAt: FieldValue.serverTimestamp() }
      : {}),
  });

  return { onboardingComplete: complete, account: acct };
}

/** Same shape used by the org portal and the checkout guard. */
export function onboardingSummary(partner) {
  const status = partner.stripeAccountStatus || {};
  return {
    hasAccount: !!partner.stripeAccountId,
    onboardingComplete: !!partner.onboardingComplete,
    detailsSubmitted: !!status.detailsSubmitted,
    chargesEnabled: !!status.chargesEnabled,
    payoutsEnabled: !!status.payoutsEnabled,
    currentlyDue: status.currentlyDue || [],
    disabledReason: status.disabledReason || null,
  };
}

/**
 * Refuses to let an order exist against a partner who cannot receive the
 * money. Better a donor sees "not available yet" than a payment that has
 * nowhere to settle.
 */
export function assertCanReceiveFunds(partner) {
  if (!partner.stripeAccountId || !partner.onboardingComplete) {
    throw new HttpError(
      409,
      `${partner.name} is not set up to receive payments yet. This gift cannot be given right now.`,
      "partner_not_onboarded",
    );
  }
}
