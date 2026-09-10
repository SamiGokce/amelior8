#!/usr/bin/env node
// Local server for api/*, so the relay purchase/deliver flow can be tested
// end-to-end without enabling Firebase's Blaze plan for real Storage.
//
// Firestore and Auth still talk to the real project (same data used
// everywhere else) — only Storage is swapped for local disk, via
// LOCAL_STORAGE_DIR (see api/_lib/admin.js and api/_lib/localStorage.js).
// Never used in production: Vercel serves api/ directly and never sets
// LOCAL_STORAGE_DIR.
import http from "node:http";
import { readLocalObject, writeLocalObject } from "../api/_lib/localStorage.js";

const PORT = Number(process.env.LOCAL_API_PORT || 5100);
const LOCAL_STORAGE_PREFIX = "/api/__local-storage/";

if (!process.env.LOCAL_STORAGE_DIR) {
  console.error("Set LOCAL_STORAGE_DIR (e.g. LOCAL_STORAGE_DIR=.local-storage) before running this.");
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT_JSON before running this — same value as in Vercel.");
  process.exit(1);
}

const router = (await import("../api/[...path].js")).default;
const stripeWebhook = (await import("../api/webhooks/stripe.js")).default;

function shimResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (body) => res.end(body);
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  shimResponse(res);
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url, "http://internal");

  try {
    if (url.pathname.startsWith(LOCAL_STORAGE_PREFIX)) {
      const objectPath = decodeURIComponent(url.pathname.slice(LOCAL_STORAGE_PREFIX.length));
      if (req.method === "PUT") {
        const buffer = await readBody(req);
        await writeLocalObject(objectPath, buffer, req.headers["content-type"]);
        res.statusCode = 200;
        return res.end("ok");
      }
      if (req.method === "GET") {
        const { buffer, contentType } = await readLocalObject(objectPath);
        res.setHeader("Content-Type", contentType);
        res.statusCode = 200;
        return res.end(buffer);
      }
      res.statusCode = 405;
      return res.end("method not allowed");
    }

    if (url.pathname === "/api/webhooks/stripe") {
      req.query = {};
      return await stripeWebhook(req, res);
    }

    req.query = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await readBody(req);
      if (raw.length) {
        try { req.body = JSON.parse(raw.toString("utf8")); } catch { req.body = raw.toString("utf8"); }
      }
    }
    return await router(req, res);
  } catch (err) {
    console.error(`[${req.method} ${req.url}]`, err);
    if (!res.headersSent) res.statusCode = 500;
    res.end(JSON.stringify({ error: "Local dev server error.", code: "local_dev_error" }));
  }
});

server.listen(PORT, () => {
  console.log(`Local API on http://127.0.0.1:${PORT} — Storage: ${process.env.LOCAL_STORAGE_DIR} (disk), Firestore/Auth: real project`);
});
