#!/usr/bin/env node
/**
 * Seeds countries, partners, and gift items so the app is usable immediately.
 *
 * ===========================================================================
 *  EVERYTHING IN HERE IS PLACEHOLDER DATA.
 *
 *  The partner organisations, their locations, the gift items and every price
 *  below are stand-ins carried over from the prototype. They are NOT real
 *  agreements and NOT verified prices.
 *
 *  `registrationNumber` is deliberately left null on every partner. Do not
 *  invent one — a plausible-looking charity registration number in a live
 *  database is worse than an obviously missing one.
 *
 *  Before switching to live Stripe keys, replace all of this with real
 *  partners under signed agreement and real prices you can source at.
 * ===========================================================================
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{...}' node scripts/seed-catalog.mjs
 *   ... --dry-run    print what would be written, write nothing
 *   ... --force      overwrite existing documents
 */

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { VERIFICATION_FEE_USD_CENTS } from "../shared/fees.js";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const COUNTRIES = [
  { code: "KE", name: "Kenya", active: true },
  { code: "UG", name: "Uganda", active: true },
  { code: "NG", name: "Nigeria", active: true },
  { code: "TZ", name: "Tanzania", active: true },
];

const PARTNERS = [
  { partnerId: "maji-safi", name: "Maji Safi Initiative", countryCode: "KE", location: "Kisumu" },
  { partnerId: "clean-wells", name: "Clean Wells Project", countryCode: "KE", location: "Nairobi" },
  { partnerId: "rural-health-ke", name: "Rural Health Kenya", countryCode: "KE", location: "Mombasa" },
  { partnerId: "bright-futures", name: "Bright Futures Academy", countryCode: "UG", location: "Kampala" },
  { partnerId: "medaid-ug", name: "MedAid Uganda", countryCode: "UG", location: "Entebbe" },
  { partnerId: "read-africa", name: "Read Africa", countryCode: "NG", location: "Lagos" },
  { partnerId: "feed-the-future", name: "Feed the Future NGO", countryCode: "NG", location: "Abuja" },
  { partnerId: "harvest-hope", name: "Harvest Hope", countryCode: "TZ", location: "Dar es Salaam" },
];

// Prices in integer USD cents. This is the gift itself, 100% of which goes to
// the partner organisation. The flat verification fee is added per order at
// checkout and is not part of an item — see shared/fees.js.
const ITEMS = [
  { itemId: "water-filter-family", name: "Family water filter", description: "A household ceramic filter that gives one family clean drinking water for about two years.", category: "water", priceUsdCents: 3200, partnerId: "maji-safi", countryCode: "KE", estimatedDeliveryDays: 7 },
  { itemId: "water-jerrycans", name: "Two 20L jerrycans", description: "Sealed water containers so a household can carry and store clean water safely.", category: "water", priceUsdCents: 1800, partnerId: "clean-wells", countryCode: "KE", estimatedDeliveryDays: 5 },
  { itemId: "school-kit", name: "School supply kit", description: "Exercise books, pens, pencils and a backpack for one pupil for a full term.", category: "education", priceUsdCents: 2200, partnerId: "bright-futures", countryCode: "UG", estimatedDeliveryDays: 6 },
  { itemId: "reading-books", name: "Set of five reading books", description: "Age-appropriate storybooks in English and the local language for a primary reader.", category: "education", priceUsdCents: 2600, partnerId: "read-africa", countryCode: "NG", estimatedDeliveryDays: 8 },
  { itemId: "mosquito-nets", name: "Two treated mosquito nets", description: "Long-lasting insecticide-treated bed nets covering a family sleeping area.", category: "health", priceUsdCents: 1600, partnerId: "rural-health-ke", countryCode: "KE", estimatedDeliveryDays: 5 },
  { itemId: "first-aid-kit", name: "Household first aid kit", description: "Basic wound care, antiseptic, and rehydration salts for a rural household.", category: "health", priceUsdCents: 2900, partnerId: "medaid-ug", countryCode: "UG", estimatedDeliveryDays: 7 },
  { itemId: "food-parcel-month", name: "One month of food staples", description: "Maize flour, beans, rice, cooking oil and salt for a family of four for a month.", category: "food", priceUsdCents: 4200, partnerId: "harvest-hope", countryCode: "TZ", estimatedDeliveryDays: 6 },
  { itemId: "school-uniform", name: "A school uniform", description: "Shirt, trousers or skirt, and shoes so a child can attend school without being turned away.", category: "clothing", priceUsdCents: 2400, partnerId: "bright-futures", countryCode: "UG", estimatedDeliveryDays: 8 },
  { itemId: "warm-blankets", name: "Two warm blankets", description: "Heavy blankets for a household through the cold season.", category: "clothing", priceUsdCents: 2000, partnerId: "harvest-hope", countryCode: "TZ", estimatedDeliveryDays: 6 },
  { itemId: "school-meals-term", name: "A term of school meals", description: "One hot meal a day for one child for a full school term.", category: "food", priceUsdCents: 3500, partnerId: "feed-the-future", countryCode: "NG", estimatedDeliveryDays: 9 },
];

function db() {
  // Against the emulator no credentials are needed or wanted.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || "amelior8it" });
    return getFirestore();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
    process.exit(1);
  }
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  initializeApp({ credential: cert(JSON.parse(json)) });
  return getFirestore();
}

async function upsert(store, collection, id, data) {
  const ref = store.collection(collection).doc(id);
  if (!FORCE) {
    const snap = await ref.get();
    if (snap.exists) return "skipped";
  }
  await ref.set({ ...data, updatedAt: new Date() }, { merge: true });
  return FORCE ? "written" : "created";
}

async function main() {
  console.log(`Seeding catalog${DRY_RUN ? " (dry run)" : ""}${FORCE ? " (force)" : ""}\n`);
  console.log("NOTE: this is placeholder data. Replace before going live.\n");

  if (DRY_RUN) {
    console.log(`${COUNTRIES.length} countries, ${PARTNERS.length} partners, ${ITEMS.length} gift items`);
    for (const item of ITEMS) {
      const total = item.priceUsdCents + VERIFICATION_FEE_USD_CENTS;
      console.log(`  ${item.itemId.padEnd(22)} $${(item.priceUsdCents / 100).toFixed(2)} gift + $${(VERIFICATION_FEE_USD_CENTS / 100).toFixed(2)} fee = $${(total / 100).toFixed(2)} (${item.countryCode})`);
    }
    return;
  }

  const store = db();
  const tally = {};
  const count = (r) => { tally[r] = (tally[r] || 0) + 1; };

  for (const c of COUNTRIES) {
    count(await upsert(store, "countries", c.code, c));
  }

  for (const p of PARTNERS) {
    count(await upsert(store, "partners", p.partnerId, {
      ...p,
      // Left null on purpose — see the header. Fill in only from a real,
      // signed partner agreement.
      registrationNumber: null,
      verified: false,
      charityOfRecord: true,
      description: null,
      logoUrl: null,
      contactEmail: null,
      active: true,
      // No Stripe account until the partner completes onboarding themselves.
      // Until then, checkout refuses to create orders against them.
      stripeAccountId: null,
      onboardingComplete: false,
      _placeholder: true,
    }));
  }

  for (const [i, item] of ITEMS.entries()) {
    count(await upsert(store, "giftItems", item.itemId, {
      ...item,
      imageUrl: null,
      available: true,
      stock: null,
      sortOrder: i,
      createdAt: new Date(),
      _placeholder: true,
    }));
  }

  console.log(Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", "));
  console.log("\nDone. Re-run with --force to overwrite existing documents.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
