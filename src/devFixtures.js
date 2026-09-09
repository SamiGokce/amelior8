/**
 * Dev-only API stub.
 *
 * Opening /org.html?preview=1 or /relay.html?preview=1 during `npm run dev`
 * replaces fetch for /api paths with fixture responses, so the screens behind
 * a login can be checked without a backend, credentials or seeded data.
 *
 * Guarded by import.meta.env.DEV at every call site, so Vite drops it entirely
 * from a production build. None of this data can reach a real user.
 */

const now = Date.now();
const ago = (mins) => new Date(now - mins * 60_000).toISOString();

const ORDERS = [
  {
    id: "A8-7K3M9Q", status: "FUNDED", item: "One month of food staples",
    itemDescription: "Maize flour, beans, rice, cooking oil and salt for a family of four.",
    category: "food", quantity: 1, giftAmount: 4200, verificationFee: 500,
    country: "Tanzania", relayId: null, relay: null, recipient: null,
    purchase: null, verification: null, hasProof: false,
    stageTimestamps: { funded: ago(180) }, createdAt: ago(190),
  },
  {
    id: "A8-2XB4YT", status: "FUNDED", item: "Family water filter",
    itemDescription: "A household ceramic filter for about two years of clean water.",
    category: "water", quantity: 2, giftAmount: 6400, verificationFee: 500,
    country: "Kenya", relayId: null, relay: null, recipient: null,
    purchase: null, verification: null, hasProof: false,
    stageTimestamps: { funded: ago(45) }, createdAt: ago(50),
  },
  {
    id: "A8-9PLM3D", status: "PURCHASED", item: "School supply kit",
    itemDescription: "Books, pens and a backpack for one pupil for a term.",
    category: "education", quantity: 1, giftAmount: 2200, verificationFee: 500,
    country: "Uganda", relayId: "rel_1", relay: "James Mwangi",
    recipient: { firstName: "Joseph", area: "Kisumu" },
    purchase: { amountPaidUsdCents: 2350, overBudget: true, varianceUsdCents: 150, submittedAt: ago(120) },
    verification: null, hasProof: false,
    stageTimestamps: { funded: ago(2880), assigned: ago(1440), purchased: ago(120) },
    createdAt: ago(2900),
  },
  {
    id: "A8-5RT8KW", status: "DELIVERED", item: "Two treated mosquito nets",
    itemDescription: "Long-lasting treated bed nets for a family sleeping area.",
    category: "health", quantity: 1, giftAmount: 1600, verificationFee: 500,
    country: "Kenya", relayId: "rel_2", relay: "Amina Otieno",
    recipient: { firstName: "Grace", area: "Mombasa" },
    purchase: { amountPaidUsdCents: 1550, overBudget: false, varianceUsdCents: -50, submittedAt: ago(300) },
    verification: {
      state: "pending",
      ai: { state: "flagged", score: 0.54, reasons: ["The item is partly out of frame.", "Cannot clearly tell a handover is taking place."], reusedFromOrderId: null },
    },
    hasProof: true,
    stageTimestamps: { funded: ago(4320), assigned: ago(2880), purchased: ago(300), delivered: ago(30) },
    createdAt: ago(4400),
  },
];

const RELAYS = [
  {
    id: "rel_1", name: "James Mwangi", username: "james-m", photoUrl: null,
    phone: "+254700000001", active: true, createdAt: ago(20000), pinSetAt: ago(20000),
    completedDeliveries: 12,
    assigned: [{ id: "A8-9PLM3D", item: "School supply kit", status: "PURCHASED", recipient: "Joseph" }],
  },
  {
    id: "rel_2", name: "Amina Otieno", username: "amina-o", photoUrl: null,
    phone: null, active: true, createdAt: ago(9000), pinSetAt: ago(400),
    completedDeliveries: 5,
    assigned: [{ id: "A8-5RT8KW", item: "Two treated mosquito nets", status: "DELIVERED", recipient: "Grace" }],
  },
  {
    id: "rel_3", name: "Peter Njoroge", username: "peter-n", photoUrl: null,
    phone: null, active: false, createdAt: ago(40000), pinSetAt: ago(40000),
    completedDeliveries: 31, assigned: [],
  },
];

// A tiny grey placeholder, so the review screen shows a real <img> without
// shipping any photograph of a person.
const PLACEHOLDER =
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="800" height="600" fill="#EDECE8"/>
      <text x="400" y="305" font-family="sans-serif" font-size="26" fill="#9A9A8C" text-anchor="middle">
        sample photo
      </text>
    </svg>`,
  );

const RELAY_JOBS = {
  open: [
    {
      id: "A8-9PLM3D", status: "ASSIGNED", item: "School supply kit",
      itemDescription: "Books, pens and a backpack for one pupil for a term.",
      category: "education", quantity: 1, budgetUsdCents: 2200, generatedForOrgUsdCents: 250,
      recipient: { firstName: "Joseph", area: "Kisumu" }, country: "Uganda",
      partner: "Bright Futures Academy", purchase: null, verification: "none",
      rejectionNote: null, assignedAt: ago(1440), deliveredAt: null,
    },
    {
      id: "A8-3QW7ZP", status: "PURCHASED", item: "One month of food staples",
      itemDescription: "Maize flour, beans, rice, cooking oil and salt for a family of four.",
      category: "food", quantity: 1, budgetUsdCents: 4200, generatedForOrgUsdCents: 250,
      recipient: { firstName: "Miriam", area: "Kisumu" }, country: "Kenya",
      partner: "Maji Safi Initiative",
      purchase: { amountPaidUsdCents: 4100, submittedAt: ago(90) },
      verification: "none", rejectionNote: null, assignedAt: ago(600), deliveredAt: null,
    },
    {
      id: "A8-8HJ2NM", status: "PROOF_REJECTED", item: "Family water filter",
      itemDescription: "A household ceramic filter for about two years of clean water.",
      category: "water", quantity: 1, budgetUsdCents: 3200, generatedForOrgUsdCents: 250,
      recipient: { firstName: "Daniel", area: "Nairobi" }, country: "Kenya",
      partner: "Clean Wells Project",
      purchase: { amountPaidUsdCents: 3200, submittedAt: ago(2000) },
      verification: "rejected",
      rejectionNote: "The filter is not visible in the photo. Please take another with the box in frame.",
      assignedAt: ago(3000), deliveredAt: null,
    },
  ],
  awaitingReview: [
    {
      id: "A8-5RT8KW", status: "DELIVERED", item: "Two treated mosquito nets",
      itemDescription: "Long-lasting treated bed nets for a family sleeping area.",
      category: "health", quantity: 1, budgetUsdCents: 1600, generatedForOrgUsdCents: 250,
      recipient: { firstName: "Grace", area: "Mombasa" }, country: "Kenya",
      partner: "Rural Health Kenya",
      purchase: { amountPaidUsdCents: 1550, submittedAt: ago(300) },
      verification: "pending", rejectionNote: null,
      assignedAt: ago(2880), deliveredAt: ago(30),
    },
  ],
  done: [],
  summary: { openCount: 3, awaitingReviewCount: 1, completedCount: 17, generatedForOrgUsdCents: 4250 },
};

const ROUTES = [
  [/^\/org\/me$/, () => ({
    user: { uid: "u1", email: "admin@majisafi.org", name: "Ruth Achieng", role: "org_admin", isAdmin: true },
    org: { partnerId: "maji-safi", name: "Maji Safi Initiative", location: "Kisumu", countryCode: "KE", active: true },
  })],
  [/^\/org\/orders\/[^/]+\/review$/, () => {
    const o = ORDERS.find((x) => x.status === "DELIVERED");
    return {
      orderId: o.id, status: o.status, item: o.item, itemDescription: o.itemDescription,
      giftAmount: o.giftAmount, recipient: o.recipient, relay: o.relay,
      recipientMessage: "Thank you so much. This will help my family a great deal.",
      purchase: o.purchase, verification: o.verification,
      proofUrl: PLACEHOLDER, receiptUrl: PLACEHOLDER,
    };
  }],
  [/^\/org\/orders/, (url) => {
    const view = new URL(url, location.origin).searchParams.get("view") || "open";
    const orders = view === "unassigned" ? ORDERS.filter((o) => o.status === "FUNDED")
      : view === "review" ? ORDERS.filter((o) => o.status === "DELIVERED")
      : ORDERS;
    return {
      orders,
      counts: {
        unassigned: ORDERS.filter((o) => o.status === "FUNDED").length,
        awaitingReview: ORDERS.filter((o) => o.status === "DELIVERED").length,
        inFlight: ORDERS.length,
      },
    };
  }],
  [/^\/org\/relays$/, () => ({ relays: RELAYS })],
  [/^\/org\/invites$/, () => ({
    invites: [{ email: "newstaff@majisafi.org", role: "org_staff", expiresAt: new Date(now + 12 * 864e5).toISOString() }],
    members: [
      { uid: "u1", email: "admin@majisafi.org", name: "Ruth Achieng", role: "org_admin", active: true },
      { uid: "u2", email: "peter@majisafi.org", name: "Peter Omondi", role: "org_staff", active: true },
    ],
  })],
  [/^\/relay\/me$/, () => ({
    relay: { relayId: "rel_1", name: "James Mwangi", username: "james-m", photoUrl: null, completedDeliveries: 17 },
    org: { partnerId: "maji-safi", name: "Maji Safi Initiative", location: "Kisumu" },
  })],
  [/^\/relay\/jobs$/, () => RELAY_JOBS],
  [/^\/org\/stripe$/, () => ({
    stripe: {
      hasAccount: true, onboardingComplete: true,
      detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true,
      currentlyDue: [], disabledReason: null,
    },
  })],
  [/^\/org\/payouts$/, () => ({
    payouts: [
      { payoutId: "maji-safi_2026-08", period: "2026-08", amountUsdCents: 3250,
        giftTotalUsdCents: 41800, deliveryCount: 13, status: "paid",
        lineItems: [], builtAt: ago(40000), paidAt: ago(20000) },
      { payoutId: "maji-safi_2026-09", period: "2026-09", amountUsdCents: 1000,
        giftTotalUsdCents: 12600, deliveryCount: 4, status: "draft",
        lineItems: [], builtAt: ago(60), paidAt: null },
    ],
  })],
];

/** Returns true if preview mode is on for this page load. */
export function previewMode() {
  return import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("preview") === "1";
}

/** Swaps fetch for the fixture responder. Dev-only, idempotent. */
export function installFixtures() {
  if (!previewMode() || window.__a8Fixtures) return;
  window.__a8Fixtures = true;

  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.includes("/api/")) return real(input, init);

    const path = url.replace(/^.*\/api/, "").split("?")[0];
    const match = ROUTES.find(([re]) => re.test(path));

    await new Promise((r) => setTimeout(r, 120));   // a beat, so loading states show

    if (!match) {
      return new Response(JSON.stringify({ error: `No fixture for ${path}` }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(match[1](url)), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
}

/** A stand-in signed-in identity, so the auth gate lets the preview through. */
export const FAKE_ORG_SESSION = {
  user: { uid: "u1", email: "admin@majisafi.org", displayName: "Ruth Achieng", emailVerified: true },
};

export const FAKE_RELAY_SESSION = {
  user: { uid: "relay_rel_1", displayName: "James Mwangi", emailVerified: false },
};
