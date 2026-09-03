# Amelior8 Donor App — Production Build Prompt

## 0. How to use this document

Build spec for taking the Amelior8 donor app from prototype to a real product
that can accept real money and track real gift deliveries.

**Read `BRAND.md` and `CLAUDE.md` before writing any code.**

### Out of scope — do not build

- **Visual design.** Do not redesign anything. Reuse the existing `glass`,
  `colors`, and `fonts` tokens and the existing screen layouts as they are.
  Assemble new screens from existing patterns and the existing `Icon` set.
  Design is a separate, later pass.
- **The GR8 facilitator app.** Not built here — but the data model, state
  machine, and endpoints it will call must exist and be exercised by this build.
- **The admin console.** Protected ops endpoints stand in for it.
- **Facilitator payouts.** No rail chosen. Record what's owed on the order;
  wire nothing.
- **Recurring giving.** One-time gifts only for now.

---

## 1. What the product is

A donor buys a specific, real gift for a recipient in a specific place. A vetted
local facilitator ("GR8") buys that gift and hands it over. The donor gets photo
proof.

The model is Uber Eats: concrete items at concrete prices, a person assigned to
fulfil the order, live status through to delivery. The facilitator is paid per
delivery like a driver.

### The four donor-visible stages

1. **Money received** — payment cleared
2. **GR8 chosen** — facilitator assigned
3. **Gift bought** — facilitator has purchased the item
4. **Gift delivered** — handed to the recipient, photo proof captured

> Stage 4 is the gift reaching the *recipient*; the *proof* is what reaches the
> donor. Flag it if that's wrong.

---

## 2. What's fake today and must become real

`Amelior8App.jsx` is 1,442 lines, one component, Vite + React 18 on Vercel.
Firebase comes in via CDN compat scripts. The only real side effect is
`processDonation()` writing to the `donors` collection. Everything else is
theatre.

| Currently faked | Must become |
|---|---|
| `setTimeout` "processing" steps | Real Stripe payment, webhook-driven |
| Hardcoded `causes`/`countries`/`partners`/`amounts` | Firestore catalog of real gift items |
| Tracking screen with canned copy | Real order status, live from Firestore |
| Video player with a progress bar | Real facilitator-uploaded delivery photo |
| "AI Verified" badge with nothing behind it | A real server-side vision check |
| Name/email typed into a form | Firebase Auth accounts |
| `donorId` from a local generator | Server-issued order IDs |

The "AI Verified" badge cannot ship as-is. Either it's backed by §8 or it goes.

---

## 3. Architecture

Keep the Vite SPA on Vercel. Add a server tier as Vercel serverless functions.

- **Client** — Vite + React 18. Migrate Firebase from the CDN compat scripts to
  the modular npm SDK. The client reads its own data from Firestore for
  real-time updates and **never writes business data**.
- **Server** — `/api/*` functions using `firebase-admin` and the Stripe Node
  SDK. All order, payment, and proof writes go through here. All secrets live
  here.
- **Data** — Firestore. **Storage** — Firebase Storage for proof photos.
  **Auth** — Firebase Auth.

### Split the single file

`CLAUDE.md`'s single-file rule is superseded for this build.

```
src/
  App.jsx                 # router + auth gate + shell
  theme.js                # glass, colors, fonts — moved verbatim
  icons.jsx               # the Icon object — moved verbatim
  components/             # Btn, InputField, CountryBadge, Header, ...
  screens/                # one file per screen
  hooks/                  # useAuth, useOrder, useCatalog
  lib/                    # firebase.js, api.js, format.js
api/
  checkout/session.js
  webhooks/stripe.js
  orders/[id]/proof-upload-url.js
  ops/orders/[id]/assign.js
  ops/orders/[id]/advance.js
  ops/proofs/[id]/review.js
  _lib/                   # admin SDK, stripe, auth middleware, email
scripts/seed-catalog.mjs
```

Move code verbatim where possible. **Update `CLAUDE.md`** to match.

---

## 4. Data model (Firestore)

This is the contract the GR8 app and admin console will later use. Get it right
now even though only the donor surface is built.

### `giftItems/{itemId}`
```
itemId, name, description, category, imageUrl,
priceUsdCents,            # the gift itself
facilitatorFeeUsdCents,   # what the GR8 earns delivering it
platformFeeUsdCents,      # Amelior8's cut
countryCode, partnerId,
available (bool), estimatedDeliveryDays
```

### `partners/{partnerId}`
```
partnerId, name, countryCode, location, logoUrl,
verified (bool), registrationNumber, active (bool)
```

### `countries/{countryCode}`
`code, name, active`

### `facilitators/{facilitatorId}`
`facilitatorId, name, photoUrl, countryCode, active` — seeded by hand; the GR8
app owns this later.

### `users/{uid}`
`uid, email, displayName, stripeCustomerId, totalGiven, giftCount, createdAt`

### `orders/{orderId}` — the core entity
```
orderId,                          # server-issued, e.g. "A8-7K3M9Q"
donorUid, donorEmail, donorName,
itemId, itemSnapshot: {...},      # denormalized at purchase — prices must
                                  # never change retroactively
partnerId, partnerSnapshot: {...}, countryCode,

# money — integer USD cents
giftAmount, facilitatorFee, platformFee, totalCharged, currency: "USD",

# payment
stripePaymentIntentId, stripeCheckoutSessionId,
paymentStatus: "pending"|"succeeded"|"failed"|"refunded",

# fulfilment
status,                           # see §5
stageTimestamps: { funded, assigned, purchased, delivered },
facilitatorId|null,
facilitatorSnapshot: { name, photoUrl }|null,

# proof
proofPhotoPath|null,              # Storage path, never a public URL
verification: {
  state: "none"|"pending"|"passed"|"flagged"|"overridden",
  method: "ai"|"human"|null,
  reasons: [string],
  reviewedBy|null, reviewedAt|null
},

# reserved for the payout system — written, not acted on
facilitatorEarning: { amountUsdCents, status: "accrued" },

createdAt, updatedAt
```

### `orders/{orderId}/events/{eventId}` — immutable audit trail
`type, fromStatus, toStatus, actor: { kind, id }, note, createdAt`

Every status change appends an event, no exceptions. This is what makes
disputes, refunds, and facilitator pay arguments resolvable later.

### `webhookEvents/{stripeEventId}`
`{ processedAt, type }` — written before processing, checked first. Stripe
retries webhooks; a duplicate order or double email is unacceptable.

### Migration
The existing `donors` collection is prototype data. Leave it, don't read it,
don't migrate it. New work uses `orders`.

---

## 5. Order state machine

```
PENDING_PAYMENT ─→ FUNDED ─→ ASSIGNED ─→ PURCHASED ─→ DELIVERED ─→ VERIFIED
       │                                                   │
       ├─→ PAYMENT_FAILED                                  └─→ PROOF_REJECTED
       └─→ CANCELLED ─→ REFUNDED                                    │
                                                    (new photo) ────┘
```

| Stage | Label | Statuses |
|---|---|---|
| 1 | Money received | `FUNDED` and later |
| 2 | GR8 chosen | `ASSIGNED` and later |
| 3 | Gift bought | `PURCHASED` and later |
| 4 | Gift delivered | `DELIVERED`, `VERIFIED` |

`VERIFIED` is not a fifth stage — it resolves the proof badge inside stage 4.

Enforced server-side in one shared module:

- **Forward-only.** No skipping, no going backward, except the documented
  `PROOF_REJECTED` return.
- **Idempotent.** Re-issuing an applied transition is a successful no-op.
- **Attributed.** Actor and timestamp on every transition.
- **One implementation.** A single `transitionOrder()`. Ops endpoints call it,
  the GR8 app will call it. Nothing writes `status` directly.

---

## 6. Auth

Firebase Auth, account required before checkout. Email/password and Google.
Email verification required before a first gift completes. Password reset.
Create `users/{uid}` on sign-up.

API routes verify the Firebase ID token from the `Authorization: Bearer` header
on every authenticated call.

Screens: sign-in, sign-up, forgot-password, verify-email, profile — built from
existing components and tokens.

---

## 7. Catalog and checkout

Replace the hardcoded arrays with Firestore reads. Browse category → country →
gift item, keeping the existing navigation shape. Item detail shows name,
description, image, price breakdown, partner, and typical delivery time.
Unavailable items appear unavailable rather than vanishing.

`scripts/seed-catalog.mjs` seeds countries, partners, and gift items so the app
works day one. Use the existing Kenya/Uganda/Nigeria/Tanzania countries and
partner names as **clearly marked placeholders**.

### Payment flow

1. Donor picks an item, signs in, confirms
2. Client calls `POST /api/checkout/session` with `itemId`
3. Server re-reads the item and **computes the price itself** — never trust a
   client amount — creates a Stripe Checkout Session (card, Apple Pay, Google
   Pay) and an order in `PENDING_PAYMENT` with the item snapshot
4. `POST /api/webhooks/stripe` handles `checkout.session.completed`: verify the
   signature, check `webhookEvents`, transition to `FUNDED`, send confirmation
5. The success screen subscribes to the order and waits for `FUNDED` — the
   webhook is the source of truth, not the redirect

Also handle `payment_intent.payment_failed` and `charge.refunded`.

All amounts are integer USD cents. Charge total = `giftAmount +
facilitatorFee + platformFee`, broken out for the donor before they pay.

**Charity of record is the partner NGO, not Amelior8.** So: nothing in the UI
may describe a gift as tax-deductible, no tax receipts are issued (send a gift
confirmation instead), and the confirmation names the partner receiving the
funds.

---

## 8. Delivery proof and verification

Photo only. Video is a later phase — shape the proof field so adding video is
additive, not a migration.

1. `POST /api/orders/[id]/proof-upload-url` returns a short-lived signed Storage
   upload URL
2. Uploader PUTs the photo
3. Server records `proofPhotoPath`, sets `verification.state = "pending"`,
   transitions to `DELIVERED`, triggers verification

**AI verification** — a server-side Claude vision call (`claude-sonnet-5` via
the Anthropic SDK). Given the photo plus the ordered item's name and
description, it returns a structured pass or flag with reasons:

- Does the photo plausibly show the item that was ordered?
- Does it show a handover, or the item in a recipient's possession?

Pass → `VERIFIED`, badge reads "AI Verified". Flag → order stays `DELIVERED`,
donor sees the photo marked "Verification in review". **Never show a false
verified.**

**Human override** — `POST /api/ops/proofs/[id]/review` approves or rejects
regardless of the AI result, recording who and why. Rejection moves the order to
`PROOF_REJECTED` and allows a replacement photo.

Never expose raw Storage paths. Serve proofs through short-lived signed read
URLs, only to that order's donor.

---

## 9. Tracking

Milestone timeline, no GPS.

- Live via a Firestore `onSnapshot` on the order — updates without a refresh
- Four stages with completed/current/pending states and real timestamps
- Facilitator name and photo once `ASSIGNED`
- Delivery photo and verification badge in stage 4
- Honest exception states: awaiting assignment, cancelled, refunded, proof
  rejected. A donor still at stage 1 after days sees an explanation, not a
  spinner.
- Order history in the profile; each entry opens its tracking view

---

## 10. Email

Transactional email via Resend. Plain, brand-consistent, no emoji. Sent from the
API layer off state transitions, deduplicated per order per type so a webhook
retry can't double-send.

| Trigger | Email |
|---|---|
| `FUNDED` | Gift confirmation, amount breakdown, partner named, tracking link |
| `ASSIGNED` | A GR8 is on it |
| `VERIFIED` | Delivered, with the proof photo |
| `REFUNDED` | Refund confirmation |

Firebase's own templates are fine for verification and password reset.

---

## 11. Ops endpoints (stand-in for the GR8 app)

How orders actually move until the facilitator app exists. Protected by a bearer
`OPS_API_KEY` **and** a Firebase custom claim `role: "ops"`. Never exposed to
the donor client.

- `POST /api/ops/orders/[id]/assign` — `{ facilitatorId }` → `ASSIGNED`
- `POST /api/ops/orders/[id]/advance` — `{ toStatus, note }`, validated
- `POST /api/ops/orders/[id]/proof-upload-url` — upload on a facilitator's behalf
- `POST /api/ops/proofs/[id]/review` — approve/reject
- `GET /api/ops/orders?status=` — queue

Add one minimal protected page at `/ops` that calls these. An unstyled table
with buttons is correct here — it is not a product surface and gets no design
effort.

**No auto-simulation. No timer that advances an order on its own.** A real donor
must never see fabricated progress.

---

## 12. Security rules

Firestore, deny by default:

- `giftItems`, `partners`, `countries` — public read, no client write
- `users/{uid}` — own document only
- `orders` — read only where `donorUid == request.auth.uid`; **no client
  writes, ever**
- `orders/*/events`, `facilitators`, `webhookEvents` — server-only
- Storage: proof photos are not publicly readable; signed URLs only

Write the rules, plus tests for the two critical denials: a donor reading
another donor's order, and any client write to an order.

---

## 13. Environment

Client (`VITE_` prefixed, public): Firebase web config.

Server (Vercel env vars, never committed, never in the client bundle):
```
FIREBASE_SERVICE_ACCOUNT_JSON
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANTHROPIC_API_KEY
RESEND_API_KEY
OPS_API_KEY
APP_BASE_URL
```

Add `.env.example`. Test and live Stripe keys switch by env var only — no code
change to go live.

---

## 14. Definition of done

Against a real Firebase project and Stripe test mode:

1. A user signs up, verifies their email, signs in
2. They browse a Firestore-backed catalog and open a real gift item
3. Checkout charges the correct server-computed amount
4. The order becomes `FUNDED` via webhook — verified by killing the browser
   before redirect and confirming it still funds
5. Replaying the same webhook event creates no duplicate order or email
6. A confirmation email arrives naming the partner NGO
7. Tracking shows stage 1, live, without a refresh
8. Ops assigns a facilitator; an open tracking screen advances to stage 2 on
   its own
9. Ops advances to `PURCHASED`; stage 3 updates
10. A proof photo uploads; a matching photo passes verification and a
    deliberately mismatched one is flagged rather than passed
11. The badge reflects the real verification state
12. A refund moves the order to `REFUNDED` and notifies the donor
13. A second account cannot read the first donor's order — proven by a rules test
14. An illegal transition (`FUNDED` → `DELIVERED`) is rejected
15. `npm run build` passes and no secret appears in `dist/`
16. `CLAUDE.md` matches the new structure

---

## 15. Working agreements

- Read `BRAND.md` and `CLAUDE.md` first
- No emoji in the UI; use the existing `Icon` set
- Don't change the visual design; reuse existing tokens and layouts
- Integer USD cents everywhere; never trust a client-supplied price
- All business writes go through `/api` with the Admin SDK
- One `transitionOrder()`; nothing writes `status` directly
- Every state change appends an event
- Run `npm run build` before committing
- Commit and push when done; don't ask for confirmation
- Where real data is missing, use clearly marked placeholders — never invent a
  real-looking charity registration number

---

## 16. Needed before live keys

Doesn't block the build; blocks the launch.

- Real partner NGOs with registration numbers and signed agreements — the
  current four are placeholders
- Real gift items and prices
- An activated Stripe account with the webhook endpoint registered
- Firebase on a paid plan, Storage and sign-in providers enabled, service
  account key issued
- An Anthropic API key
- A vetted facilitator roster
- Launch country, and the payout rail that follows from it
