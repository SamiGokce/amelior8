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
- **Payments**: Stripe Checkout (one-time + monthly), webhook-driven
- **Email**: Resend
- **Verification**: Claude vision (`claude-sonnet-5`) via the Anthropic SDK
- **Deploy**: Vercel (auto-deploys from `main`)
- **Styling**: Inline styles — light card design system (see Brand & Design)

## Structure

```
shared/orderStatus.js     # order lifecycle — imported by BOTH client and api
src/
  App.jsx                 # router + auth gate + phone shell
  theme.js                # colors, fonts, surfaces, radius, shadow
  icons.jsx               # the Icon object
  components/             # Btn, Chip, SearchField, Catalog, Brand, Header, States
  DesignPreview.jsx       # dev-only reference screens, stripped from prod
  screens/                # one file per screen
  hooks/                  # useAuth, useCatalog, useOrder
  lib/                    # firebase.js, api.js, format.js
api/
  _lib/                   # admin, auth, stripe, email, orderState, proof, verification
  checkout/session.js     # creates the order + Stripe session
  webhooks/stripe.js      # the source of truth for payment
  orders/[id]/            # proof upload (relay), proof read (donor)
  ops/                    # stand-in for the relay app until it exists
  subscriptions/
public/ops.html           # internal ops console
scripts/seed-catalog.mjs  # placeholder catalog data
firestore.rules           # deny by default
storage.rules
tests/
```

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm test` — state machine unit tests
- `npm run test:rules` — security rules tests (needs the Firestore emulator)
- `npm run seed` — seed the catalog (needs `FIREBASE_SERVICE_ACCOUNT_JSON`)
- `npm run emulator` / `seed:emulator` / `dev:emulator` — local Firebase
  emulator workflow (needs Java installed)
- `npm run screenshot` — build, launch, capture a 2x retina screenshot

## Workflow
- Always commit and push after completing changes
- Don't ask for confirmation — just do it
- Keep responses short and direct
- Always run `npm run build` before committing to verify the build passes

## Non-negotiables

These protect real money and real donor data. Do not work around them.

- **All amounts are integer USD cents.** No floats.
- **The server computes every price**, read from Firestore. Never trust a
  client-supplied amount.
- **All business writes go through `/api`** with the Admin SDK. The client
  never writes an order.
- **One `transitionOrder()`.** Nothing writes `status` directly. Transitions
  are forward-only, idempotent, and attributed.
- **Every state change appends an event** to `orders/{id}/events`.
- **Never show a verification badge that isn't earned.** A pending or flagged
  photo reads "Verification in review", never "Verified".
- **No auto-simulation.** Nothing advances an order on a timer. A real donor
  must never see fabricated progress.
- **Secrets stay server-side.** Anything `VITE_` prefixed ships to the browser.
- **Partner NGOs are the charity of record**, not Amelior8. Nothing in the UI
  may call a gift a tax-deductible donation, and no tax receipts are issued.
- **Never invent partner registration numbers** or other real-looking
  credentials. Leave them null.

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
- `npm run dev` then `/preview` renders the three reference screens with sample
  data. It is dev-only and tree-shaken out of production builds.

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
