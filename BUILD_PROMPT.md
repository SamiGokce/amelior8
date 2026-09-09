# Amelior8 Donor App — Production Build Prompt

## 0. How to use this document

This is the build spec for taking the Amelior8 donor app from prototype to a
real, functional product that can accept real money and track real gift
deliveries.

**Read `BRAND.md` and `CLAUDE.md` before writing any code.**

### Explicitly out of scope for this build

Do not work on any of the following. They are separate, later efforts:

- **Visual design.** Do not redesign anything. Reuse the existing `glass`,
  `colors`, and `fonts` tokens and the existing screen layouts exactly as they
  are. New screens should be assembled from existing patterns and the existing
  `Icon` set. Design will be revisited separately.
- **The relay relay app.** Not built here. But every contract it will need
  (data model, state machine, API endpoints) must exist and be exercised by this
  build, so that app can be added later with zero changes to donor-side code.
- **The admin/ops console.** Not built here. Protected ops endpoints stand in
  for it.
- **Relay payouts.** No payout rail (M-Pesa, Flutterwave, Stripe Connect)
  is chosen yet. Model the money owed, write the ledger records, wire nothing.

---

## 1. What the product is

Amelior8 is a marketplace for verified charitable giving. A donor buys a
specific, real gift for a specific recipient in a specific place. A vetted local
relay ("relay") buys that gift and hands it over. The donor gets photo proof
of the handover.

The mental model is Uber Eats: a catalog of concrete items at concrete prices, a
person assigned to fulfil the order, and live status tracking through to
delivery. The relay is compensated per delivery like a driver.

### The four donor-visible stages

1. **Money received** — donation captured, funds cleared
2. **relay chosen** — a relay has been assigned to this gift
3. **Gift bought** — relay has purchased the item
4. **Gift delivered** — handed to the recipient, photo proof captured

> **Assumption to confirm:** stage 4 is the gift being delivered *to the
> recipient*; the *proof* is what's delivered to the donor. The spec is written
> that way. Flag it if that's wrong.

---

## 2. Current state of the codebase

- `Amelior8App.jsx` — 1,442 lines, the entire app in one component
- Vite 6 + React 18 SPA, deployed on Vercel from `main`
- Firebase loaded via CDN compat SDK in `index.html`; config is inline in the
  JSX (fine — Firebase web keys are public by design)
- One real side effect: `processDonation()` writes a doc to the `donors`
  collection. Everything else is theatre.

### What is fake today and must become real

| Currently faked | Must become |
|---|---|
| `setTimeout` "processing" steps | Real Stripe payment + webhook-driven order creation |
| Hardcoded `causes`/`countries`/`partners` | Firestore-backed catalog of real gift items |
| `amounts = [20, 50, 100, 250]` | Real item prices from the catalog |
| Tracking screen with canned copy | Real order status from Firestore, live-updating |
| Video player with a progress bar | Real relay-uploaded delivery photo |
| "AI Verified" badge with nothing behind it | A real server-side vision check |
| No auth, name/email typed into a form | Firebase Auth accounts |
| `donorId` from a local generator | Server-issued order IDs |

The "AI Verified" badge in particular must not ship in its current form. Either
it is backed by the verification pipeline in §9 or it is removed.

---

## 3. Architecture

Keep the Vite SPA on Vercel. Add a server tier as Vercel serverless functions.

- **Client**: Vite + React 18 SPA. Firebase Web SDK (migrate from the CDN compat
  scripts to the modular npm package — `firebase/app`, `firebase/auth`,
  `firebase/firestore`, `firebase/storage`). Client reads its own data directly
  from Firestore for real-time updates. The client never writes business data.
- **Server**: `/api/*` Vercel serverless functions using `firebase-admin` and
  the Stripe Node SDK. All writes to orders, payments, and proofs go through
  here. All secrets live here.
- **Data**: Firestore. **Storage**: Firebase Storage for proof photos.
  **Auth**: Firebase Auth.

### Split the single file

`CLAUDE.md` currently says to keep everything in `Amelior8App.jsx`. That rule is
superseded for this build. Restructure to:

```
src/
  main.jsx
  App.jsx                 # router + auth gate + shell
  theme.js                # glass, colors, fonts — moved verbatim, unchanged
  icons.jsx               # the Icon object — moved verbatim, unchanged
  components/             # Btn, InputField, QRCode, CountryBadge, Header, etc.
  screens/                # one file per screen
  hooks/                  # useAuth, useOrder, useCatalog
  lib/
    firebase.js           # client SDK init
    api.js                # typed fetch wrapper for /api
    format.js             # money, dates
api/
  checkout/session.js
  webhooks/stripe.js
  orders/[id]/proof-upload-url.js
  ops/orders/[id]/assign.js
  ops/orders/[id]/advance.js
  ops/proofs/[id]/review.js
  subscriptions/cancel.js
  _lib/                   # admin SDK, stripe client, auth middleware, email
scripts/
  seed-catalog.mjs
```

Move code verbatim where possible. **Update `CLAUDE.md` to describe the new
structure** so the single-file rule no longer contradicts the codebase.

---

## 4. Data model (Firestore)

This schema is the contract with the relay app and admin console. Design it for
all three surfaces now, even though only the donor surface is built.

### `users/{uid}`
```
uid, email, displayName, photoURL, phone|null,
createdAt, lastSeenAt,
stripeCustomerId|null,
totalGiven (number, USD cents), giftCount (number),
notificationPrefs: { email: bool }
```

### `giftItems/{itemId}` — the catalog
```
itemId, name, description,
category ("water"|"education"|"health"|"food"),
priceUsdCents (number),          # what the gift itself costs
relayFeeUsdCents (number), # what the relay earns delivering it
platformFeeUsdCents (number),    # Amelior8's cut
countryCode, partnerId,
imageUrl,
available (bool), stock (number|null),
estimatedDeliveryDays (number),
sortOrder, createdAt, updatedAt
```

### `partners/{partnerId}` — NGOs
```
partnerId, name, countryCode, location,
verified (bool), registrationNumber, charityOfRecord (bool),
description, logoUrl,
contactEmail,
active (bool)
```

### `countries/{countryCode}`
```
code, name, active (bool), activeGiftCount
```

### `orders/{orderId}` — the core entity
```
orderId,                          # server-issued, human-readable e.g. "A8-7K3M9Q"
donorUid, donorEmail, donorName,
itemId, itemSnapshot: {...},      # denormalized copy at purchase time — prices
                                  # must never change retroactively
partnerId, partnerSnapshot: {...},
countryCode,

# money, all USD cents
giftAmount, relayFee, platformFee, totalCharged,
currency: "USD",

# payment
stripePaymentIntentId, stripeCheckoutSessionId,
paymentStatus: "pending"|"succeeded"|"failed"|"refunded",
subscriptionId|null,              # set if this order came from recurring giving

# fulfilment
status,                           # see §5
stageTimestamps: { funded, assigned, purchased, delivered },
relayId|null,
relaySnapshot: { name, photoUrl, rating }|null,
recipientRef|null,                # opaque handle, set by partner/relay side
estimatedDeliveryAt|null,

# proof
proofPhotoPath|null,              # Storage path, not a public URL
verification: {
  state: "none"|"pending"|"passed"|"flagged"|"failed"|"overridden",
  method: "ai"|"human"|null,
  score: number|null,
  reasons: [string],
  reviewedBy: string|null,
  reviewedAt: timestamp|null
},

# ledger — reserved for the payout system, written but not acted on
relayEarning: { amountUsdCents, status: "accrued"|"payable"|"paid", payoutId|null },

createdAt, updatedAt, cancelledAt|null
```

### `orders/{orderId}/events/{eventId}` — immutable audit trail
```
type, fromStatus, toStatus,
actor: { kind: "system"|"ops"|"relay"|"donor", id },
metadata, createdAt
```

Every status change appends an event. No exceptions. This is what makes
disputes, refunds, and relay pay arguments resolvable later.

### `subscriptions/{subscriptionId}` — recurring giving
```
subscriptionId, donorUid, stripeSubscriptionId,
itemId, itemSnapshot, amountUsdCents, interval: "month",
status: "active"|"paused"|"cancelled",
nextChargeAt, createdOrderIds: [], createdAt, cancelledAt|null
```

### `relays/{relayId}` — reserved
Minimal now: `relayId, name, photoUrl, countryCode, active, rating,
completedDeliveries`. Seeded manually; the relay app owns this later.

### `payouts/{payoutId}` — reserved
`payoutId, relayId, orderIds: [], amountUsdCents, status: "draft",
createdAt`. Records accrue; nothing sends money.

### `webhookEvents/{stripeEventId}`
`{ processedAt, type }` — written before processing, checked first. Stripe
retries webhooks; double-charging or double-creating an order is unacceptable.

### Migration
The existing `donors` collection is prototype data. Leave it in place, do not
read from it, do not migrate it. New work uses `orders`.

---

## 5. Order state machine

```
PENDING_PAYMENT
   ├─→ FUNDED  ─→ ASSIGNED ─→ PURCHASED ─→ DELIVERED ─→ VERIFIED
   │                 │            │            │
   │                 └────────────┴────────────┴──→ ON_HOLD ─→ (back to prior)
   └─→ PAYMENT_FAILED
                                              DELIVERED ─→ PROOF_REJECTED ─→ DELIVERED
   any non-terminal ─→ CANCELLED ─→ REFUNDED
```

Donor-visible stage mapping:

| Stage | Label | Statuses |
|---|---|---|
| 1 | Money received | `FUNDED` and later |
| 2 | relay chosen | `ASSIGNED` and later |
| 3 | Gift bought | `PURCHASED` and later |
| 4 | Gift delivered | `DELIVERED`, `VERIFIED` |

`VERIFIED` is not a fifth stage in the UI — it resolves the proof badge inside
stage 4.

Rules, enforced server-side in one shared module:

- **Forward-only.** No transition may skip a stage or move backward, except the
  documented `ON_HOLD` and `PROOF_REJECTED` returns.
- **Idempotent.** Re-issuing a transition already applied is a no-op returning
  success, not an error.
- **Attributed.** Every transition records actor and timestamp.
- **Single implementation.** One `transitionOrder()` function. The ops endpoints
  and, later, the relay app both call it. No status field is ever written
  directly.

---

## 6. Auth

Firebase Auth, account required before checkout.

- Email/password, Google, and Apple sign-in
- Email verification required before a first gift completes
- Password reset flow
- On sign-up, create `users/{uid}`
- Client holds the session; API routes verify the Firebase ID token from the
  `Authorization: Bearer` header on every authenticated call
- Sign-out, and account deletion that anonymizes rather than destroys orders
  (orders are financial records)

Screens to add: sign-in, sign-up, forgot-password, email-verification-pending,
profile. Build them from existing components and tokens.

---

## 7. Catalog

Replace the hardcoded `causes`/`countries`/`partners`/`amounts` arrays with
Firestore reads.

- Browse: category → country → gift item (keep the existing navigation shape,
  now driven by real data)
- Item detail: name, description, image, price breakdown, partner, estimated
  delivery window
- Unavailable or out-of-stock items are visibly unavailable, not hidden
- Cache the catalog client-side; it changes rarely

**`scripts/seed-catalog.mjs`** seeds countries, partners, and gift items so the
app is usable immediately. Seed with the existing Kenya/Uganda/Nigeria/Tanzania
countries and the existing partner names as placeholders, with realistic gift
items and prices per category. Mark clearly in the script that these are
placeholders pending real partner data.

---

## 8. Checkout and payments

Stripe, one-time and recurring, built live-ready but run on test keys until
switched.

**Flow:**
1. Donor picks an item, signs in, confirms
2. Client calls `POST /api/checkout/session` with `itemId`, quantity, and
   whether it's one-time or monthly
3. Server re-reads the item from Firestore and **computes the price
   server-side** — never trust a client-supplied amount — creates a Stripe
   Checkout Session (card, Apple Pay, Google Pay), and creates the order in
   `PENDING_PAYMENT` with the item snapshot
4. Donor pays in Stripe Checkout, returns to a success route
5. `POST /api/webhooks/stripe` receives `checkout.session.completed`, verifies
   the signature, checks `webhookEvents` for idempotency, transitions the order
   to `FUNDED`, sends the confirmation email
6. The success screen subscribes to the order and waits for `FUNDED` rather than
   assuming success — the webhook is the source of truth, not the redirect

**Recurring:** monthly Stripe Subscription. Each `invoice.paid` creates a new
order from the stored item snapshot. Donor can view and cancel subscriptions in
their profile.

**Also handle:** `payment_intent.payment_failed`, `charge.refunded`,
`customer.subscription.deleted`.

**Money handling:** all amounts are integer USD cents everywhere. No floats. No
client-supplied prices. Charge total = `giftAmount + relayFee +
platformFee`, and the breakdown is shown to the donor before they pay.

### Charity of record

Partner NGOs are the charity of record, not Amelior8. Therefore:

- Do not describe gifts as tax-deductible donations anywhere in the UI
- Do not generate tax receipts — send a purchase/gift confirmation instead
- The confirmation names the partner NGO receiving the funds
- Store `partnerSnapshot.registrationNumber` on the order for the audit trail

---

## 9. Delivery proof and verification

Photo only for this build. Video is a later phase — but store proof as a
collection-shaped field so adding video is additive, not a migration.

**Upload path** (used by the relay app later, exercised by ops now):
1. `POST /api/orders/[id]/proof-upload-url` returns a short-lived signed
   Firebase Storage upload URL
2. Uploader PUTs the photo
3. Server records `proofPhotoPath`, sets `verification.state = "pending"`,
   transitions the order to `DELIVERED`, and triggers verification

**AI verification** — a server-side Claude vision call. Use the current
`claude-sonnet-5` model via the Anthropic SDK. Given the photo plus the order's
item name and description, it checks:

- Does the photo plausibly show the item that was ordered?
- Does it show a handover or the item in a recipient's possession?
- Are there signs of reuse — is this photo already attached to another order
  (compare stored perceptual hashes)?
- Is anything inconsistent with the stated country/location?

It returns a structured pass / flag / fail with reasons and a confidence score,
all written to `verification`. Pass → `VERIFIED`, badge reads "AI Verified".
Flag or fail → `verification.state` set, order stays `DELIVERED`, ops is
notified, donor sees the photo marked "Verification in review" — never a false
"verified".

**Human override:** `POST /api/ops/proofs/[id]/review` lets ops approve or
reject regardless of the AI result, recording who and why. An override sets
`method: "human"` / `state: "overridden"`. A rejection moves the order to
`PROOF_REJECTED`, notifies the donor honestly, and lets a replacement photo be
uploaded.

Never expose raw Storage paths to the client. Serve proofs through short-lived
signed read URLs, and only to the order's donor.

---

## 10. Tracking

Milestone timeline with ETA. No live GPS.

- Real-time via a Firestore `onSnapshot` listener on the order — the screen
  updates without a refresh
- Four stages with completed/current/pending states and real timestamps
- Relay first name and photo once `ASSIGNED`
- Estimated delivery window from `estimatedDeliveryAt`, computed at assignment
  from the item's `estimatedDeliveryDays`
- Delivery photo and verification badge in stage 4
- Honest empty and exception states: awaiting assignment, on hold, cancelled,
  refunded, proof rejected. A donor who paid days ago and is still at stage 1
  must see an explanation, not a spinner.
- Order history list in the profile; each entry opens its tracking view
- Keep the existing QR code screen, but the QR must encode a real deep link to
  the order's tracking page

---

## 11. Email notifications

Transactional email via Resend. Plain, brand-consistent, no emoji.

| Trigger | Email |
|---|---|
| `FUNDED` | Gift confirmation + amount breakdown + partner named + tracking link |
| `ASSIGNED` | A relay has been assigned, with estimated delivery |
| `PURCHASED` | Gift purchased |
| `VERIFIED` | Delivered — with the proof photo and tracking link |
| `PROOF_REJECTED` | Honest status update, no blame, what happens next |
| `CANCELLED` / `REFUNDED` | Refund confirmation |
| Auth | Verification and password reset (Firebase templates are fine) |

Send from the API layer, keyed off state transitions, deduplicated per order per
type so a webhook retry can't double-send.

---

## 12. Ops endpoints (stand-in for the relay app)

These are how orders actually move until the relay app exists. Protect
them with a bearer `OPS_API_KEY` **and** a Firebase custom claim `role: "ops"`.
Never expose them to the donor client.

- `POST /api/ops/orders/[id]/assign` — body `{ relayId }` → `ASSIGNED`
- `POST /api/ops/orders/[id]/advance` — body `{ toStatus, note }` → validated
  transition
- `POST /api/ops/orders/[id]/proof-upload-url` — get an upload URL on a
  relay's behalf
- `POST /api/ops/proofs/[id]/review` — approve/reject
- `GET /api/ops/orders?status=` — queue view

Build a single minimal protected HTML page at `/ops` that calls these — an
unstyled table with buttons is fine and correct here. It is not a product
surface and no design effort should go into it.

**Do not add any auto-simulation or timer that advances orders on its own.** A
real donor must never see fabricated progress.

---

## 13. Security rules

Firestore rules, deny by default:

- `giftItems`, `partners`, `countries` — public read, no client write
- `users/{uid}` — read/write own document only, and only the profile fields
- `orders` — read only where `donorUid == request.auth.uid`; **no client writes,
  ever**
- `orders/*/events`, `payouts`, `relays`, `webhookEvents`,
  `subscriptions` — no client access; server-only
- Storage: proof photos are not publicly readable; access is via signed URLs only

Write the rules file, and write rules tests for the critical denials: a donor
reading another donor's order, and any client attempting to write an order.

---

## 14. Environment and configuration

Client (`VITE_` prefixed, safe to expose): Firebase web config.

Server (Vercel env vars, never in the client bundle, never committed):
```
FIREBASE_SERVICE_ACCOUNT_JSON
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANTHROPIC_API_KEY
RESEND_API_KEY
OPS_API_KEY
APP_BASE_URL
```

Add `.env.example` documenting every variable. Verify no secret can reach the
client bundle. Keep test and live Stripe keys switchable by env var only — no
code change to go live.

---

## 15. Definition of done

The build is complete when all of these are true against a real Firebase project
and Stripe test mode:

1. A new user signs up, verifies their email, and signs in
2. They browse a Firestore-backed catalog and open a real gift item
3. They check out through Stripe and are charged the correct server-computed
   amount
4. The webhook fires and the order becomes `FUNDED` — verified by killing the
   browser before redirect and confirming the order still funds correctly
5. Replaying the same webhook event creates no duplicate order or email
6. The donor receives a confirmation email naming the partner NGO
7. The tracking screen shows stage 1 complete, live, without a refresh
8. Ops assigns a relay; the donor's open tracking screen advances to
   stage 2 on its own
9. Ops advances to `PURCHASED`; stage 3 updates; email sends
10. A proof photo is uploaded; AI verification runs; a matching photo passes and
    a deliberately mismatched photo is flagged rather than passed
11. The donor sees the photo and a badge that reflects the real verification
    state
12. A monthly recurring gift creates a subscription, and a simulated
    `invoice.paid` creates a second order
13. Cancelling a subscription stops future orders
14. A refund moves the order to `REFUNDED` and notifies the donor
15. A second donor account cannot read the first donor's order — verified by a
    rules test
16. Attempting an illegal transition (e.g. `FUNDED` → `DELIVERED`) is rejected
17. `npm run build` passes clean
18. No secret appears in `dist/`
19. `CLAUDE.md` is updated to match the new structure

---

## 16. Working agreements

- Read `BRAND.md` and `CLAUDE.md` first
- No emoji anywhere in the UI; use the existing `Icon` set
- Do not change the visual design; reuse existing tokens and layouts
- All amounts in integer USD cents; never trust a client-supplied price
- All business writes go through `/api` with the Admin SDK
- One `transitionOrder()` implementation; nothing writes `status` directly
- Every state change appends an event
- Run `npm run build` before committing
- Commit and push when done; do not ask for confirmation
- Where real data is missing (partner details, gift prices), use clearly marked
  placeholders — never invent a real-looking charity registration number

---

## 17. Open items to supply before going live

These do not block the build. They block the switch to live keys.

- Real partner NGOs, with registration numbers and signed agreements — the
  current four are placeholders
- Real gift items and prices per partner and country
- A Stripe account, activated, with live keys and the webhook endpoint registered
- Firebase project confirmed on a paid plan with Storage and the sign-in
  providers enabled, plus a service account key
- An Anthropic API key for verification
- A vetted relay roster to seed `relays`
- The decision on which country launches first, and the payout rail that follows
  from it
