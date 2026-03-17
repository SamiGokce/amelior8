# Amelior8 — Donor App

## Project overview
Single-page React donation app (Vite + React 18) deployed on Vercel.
Donors choose a cause, country, and partner NGO, then receive a QR code
and AI-verified video proof of delivery. Will eventually include payments,
auth, and a full backend.

## Stack
- **Framework**: React 18 (single component in `Amelior8App.jsx`)
- **Build**: Vite 6
- **Backend**: Firebase Firestore (loaded via CDN compat SDK in `index.html`)
- **Deploy**: Vercel (auto-deploys from `main`)
- **Styling**: Inline styles — liquid glass design system (glassmorphism, backdrop-filter blur, SVG icons)

## Key files
- `Amelior8App.jsx` — entire app (all screens, logic, icons, design tokens)
- `src/main.jsx` — React entry point
- `index.html` — HTML shell + Firebase CDN scripts
- `vite.config.js` — Vite config

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — preview production build
- `npm run screenshot` — build, launch, and capture a 2x retina screenshot to `screenshots/`

## Workflow
- Always commit and push after completing changes
- Don't ask for confirmation — just do it
- Keep responses short and direct
- Always run `npm run build` before committing to verify the build passes

## Screenshot verification (MANDATORY for visual changes)
After any UI/styling change, follow this loop:
1. Run `npm run screenshot` to capture the current state
2. Read the screenshot file to visually inspect the result
3. Compare against brand guidelines (`BRAND.md`) and any user-provided reference images
4. If something is off — fix it, re-screenshot, and re-check
5. Only commit once the screenshot looks correct

Screenshots are saved to `screenshots/` (gitignored). This is the primary way to catch visual regressions, color mismatches, spacing issues, and brand violations before pushing.

## Brand & Design (MANDATORY)
**Before writing ANY frontend code, read `BRAND.md` first. No exceptions.**

- `BRAND.md` — full brand guidelines (colors, typography, logo usage, accessibility)
- No emojis anywhere in the UI — use inline SVG icons via the `Icon` object
- All styling is inline React styles, no CSS files
- Design tokens live in `glass`, `colors`, and `fonts` objects in `Amelior8App.jsx`
- Liquid glass aesthetic layered on the brand palette (Cloud Dancer glass surfaces, Burnt Orange accents, Charcoal text)
- Keep everything in the single `Amelior8App.jsx` file unless splitting is explicitly requested

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

## Deployment
Push to `main` triggers Vercel auto-deploy.
