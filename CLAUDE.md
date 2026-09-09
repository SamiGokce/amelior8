# Amelior8 — Donor App

## Project overview
React donation app (Vite + React 18) deployed on Vercel. A donor buys a
specific gift for a recipient in a specific place. A vetted local relay
("relay") buys it and hands it over, and the donor gets photo proof.

Real Stripe payments, Firebase Auth accounts, a Firestore-backed gift catalog,
a four-stage order state machine, and AI-verified delivery photos.

## Stack
- **Framework**: React 18 SPA, react-router-dom
- **Build**: Vite 6
- **Server**: Vercel serverless functions in `api/`, `firebase-admin` + Stripe
- **Data**: Firestore. **Storage**: Firebase Storage. **Auth**: Firebase Auth
- **Payments**: Stripe Checkout with **Connect destination charges** — money
  settles in the partner's own account; we take an application fee
- **Email**: Resend
- **Verification**: Claude vision (`claude-sonnet-5`) via the Anthropic SDK
- **Deploy**: Vercel (auto-deploys from `main`)
- **Styling**: Inline styles — light card design system (see Brand & Design)

## Structure

```
shared/
  orderStatus.js          # order lifecycle — imported by client AND api
  roles.js                # who can do what; relay username/PIN identity
  fees.js                 # the money model — the only place a price is computed
src/
  theme.js  icons.jsx  components/  lib/     # shared by all three front ends
  App.jsx  screens/  hooks/                  # donor app          -> index.html
  org/     App.jsx api.js components.jsx screens/   # org portal  -> org.html
  relay/   App.jsx api.js offline.js PhotoInput.jsx screens/  # relay -> relay.html
  DesignPreview.jsx       # dev-only reference screens, stripped from prod
api/
  _lib/                   # admin, auth, stripe, connect, email, orderState,
                          # proof, images, verification, review, invites, payouts
  checkout/  webhooks/  orders/  subscriptions/     # donor
  org/                    # org portal: queue, assign, review, relays, invites
  relay/                  # relay app: jobs, purchase, deliver
  ops/                    # Amelior8 backstop + org onboarding
  invites/accept.js
public/ops.html           # internal ops console
scripts/seed-catalog.mjs  # placeholder catalog data
firestore.rules  storage.rules  firestore.indexes.json
tests/
```

## The three surfaces and who does what

| Step | Who | Where |
|---|---|---|
| Buys a gift | Donor | `/` |
| Assigns a relay + records the recipient | Org staff | `/org` |
| Buys the gift, submits receipt + amount | Relay | `/relay` |
| Hands it over, submits the photo | Relay | `/relay` |
| Automatic check runs | System | advisory only |
| Approves or rejects the delivery | Org staff | `/org` |
| Backstop override for disputes | Amelior8 ops | `/ops` |

Roles live in Firebase Auth custom claims, set only by the Admin SDK. Ops
invites an organisation; that org's admin invites their own colleagues and
creates their own relays.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm test` — state machine unit tests
- `npm run test:rules` — security rules tests (needs the Firestore emulator)
- `npm run seed` — seed the catalog (needs `FIREBASE_SERVICE_ACCOUNT_JSON`)
- `npm run emulator` / `seed:emulator` / `dev:emulator` — local Firebase
  emulator workflow (needs Java installed)
- `npm run screenshot` — build, launch, capture a 2x retina screenshot

Local URLs: `/` donor, `/org` org portal, `/relay` relay app, `/ops.html` ops.

## Workflow
- Always commit and push after completing changes
- Don't ask for confirmation — just do it
- Keep responses short and direct
- Always run `npm run build` before committing to verify the build passes

## Non-negotiables

These protect real money and real donor data. Do not work around them.

- **All amounts are integer USD cents.** No floats.
- **The server computes every price** via `shared/fees.js`, read from Firestore.
  Never trust a client-supplied amount.

### The money model
- A gift's `priceUsdCents` goes **100% to the partner**. Items carry no fees.
- A **flat `verificationFeeUsdCents` ($5) is added per order**, never per item
  and never multiplied by quantity.
- It splits evenly: our half is Stripe's `application_fee_amount`, the
  partner's half rides the destination transfer. Odd cents go to the partner.
- **Checkout shows two lines, always** — "Your gift" and "Verified delivery".
  Never collapse them into one number; this is a donor-trust requirement.
- **Amelior8 never holds donor funds.** Charges are destination charges against
  the partner's connected account.
- **No order may be created against a partner without completed Connect
  onboarding.** `assertCanReceiveFunds()` guards checkout.
- **`payouts` are keyed by `partnerId`, never by relay.** No money is owed to
  an individual relay by this system; their organisation pays them. The relay
  app may show a relay what their work generated, as display only.
- **All business writes go through `/api`** with the Admin SDK. The client
  never writes an order.
- **One `transitionOrder()`.** Nothing writes `status` directly. Transitions
  are forward-only, idempotent, and attributed.
- **Every state change appends an event** to `orders/{id}/events`.
- **Never show a verification badge that isn't earned.** A pending or flagged
  photo reads "Verification in review", never "Verified".
- **The AI check advises; it never decides.** Only a human approval moves an
  order to VERIFIED. "AI Verified" is shown only when the check passed AND a
  human agreed; a human approving over a flag reads plain "Verified".
- **One `reviewDelivery()`.** Org and ops approvals run the same code path.
- **An org is scoped to its own partnerId, a relay to its own relayId**, checked
  server-side per request and per order — never from anything the client sends.
- **Never tell a relay something was submitted until the server confirmed it.**
  Offline work reads "waiting to send", not "done".
- **No auto-simulation.** Nothing advances an order on a timer. A real donor
  must never see fabricated progress.
- **Secrets stay server-side.** Anything `VITE_` prefixed ships to the browser.
- **Partner NGOs are the charity of record**, not Amelior8. Nothing in the UI
  may call a gift a tax-deductible donation, and no tax receipts are issued.
- **Never invent partner registration numbers** or other real-looking
  credentials. Leave them null.

### Safeguarding (delivery capture must never ship without these)
- **Consent is explicit.** `recipientConsent` is a recorded boolean confirmed by
  the relay at capture. The server refuses a delivery without it. A photo
  existing is never taken as agreement.
- **Location data never survives upload.** The relay app re-encodes every photo
  via canvas (dropping EXIF/GPS), and the server strips metadata again on
  receipt. An image that cannot be stripped is deleted, not stored.
- **Donors see a blurred derivative, never the original.** `proofDonorPath` is
  generated after verification; faces are blurred from the vision call's
  bounding boxes. If face positions are uncertain, the whole image is blurred.
  If no derivative exists, the donor sees no photo — the unblurred original is
  never a fallback. The org sees the original in review; ops for disputes.

## Brand & Design (MANDATORY)
**Before writing ANY frontend code, read `BRAND.md` first. No exceptions.**

- No emojis anywhere in the UI — use inline SVG icons via the `Icon` object
- All styling is inline React styles, no CSS files
- Design tokens live in `src/theme.js` (`colors`, `fonts`, `surfaces`, `radius`, `shadow`)
- Light card system: white cards on a near-white ground, soft shadows,
  Charcoal pill CTAs with a trailing arrow. Burnt Orange is the accent, not the
  CTA colour — this follows the approved mockups and diverges from BRAND.md's
  "Burnt Orange for primary actions" and Cloud Dancer backgrounds. Typography,
  the wordmark and the palette itself are unchanged.
- `npm run dev` then `/preview` renders the three donor reference screens with
  sample data. `/org.html?preview=1` and `/relay.html?preview=1` do the same for
  the org portal and relay app, stubbing the API with fixtures so the screens
  behind a login can be checked without credentials. All dev-only and dropped
  from production builds (verified against `dist/`).

### Key brand colors
- Burnt Orange `#CC5602` — logo, headlines, CTAs
- Cloud Dancer `#F0EBE1` — backgrounds, light surfaces
- Charcoal `#2C2C2A` — dark backgrounds, primary text
- Olive Drab `#6B6B52` — muted/secondary
- Dusty Teal `#7A9A94` — accents

### Typography
- H1/Display: Bricolage Grotesque, 700, -0.05em tracking
- H2-H4/UI: Helvetica Neue, 700
- Body: Georgia, 500
- Caption: 12px, 600, uppercase

## Screenshot verification (MANDATORY for visual changes)
After any UI/styling change:
1. `npm run screenshot`
2. Read the screenshot file and inspect it
3. Compare against `BRAND.md` and any reference images
4. Fix, re-screenshot, re-check
5. Only commit once it looks correct

Screenshots go to `screenshots/` (gitignored).

## Environment
See `.env.example`. Client config is `VITE_` prefixed and public; everything
else is a Vercel environment variable and must never be committed. Stripe test
vs live is `STRIPE_SECRET_KEY` and nothing else — going live is a config
change, never a code change.

## Deployment
Push to `main` triggers Vercel auto-deploy. Deploy rules separately:
`firebase deploy --only firestore:rules,storage:rules`.
