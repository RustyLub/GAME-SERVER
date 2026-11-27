import crypto from "node:crypto";
import express from "express";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { VIP_DURATION_DAYS, buildPlategaPaymentBody, constantTimeSecretMatch, isValidSteamId64, nextVipExpiry, parseVipPrice } from "./vip.js";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = requiredEnv("FRONTEND_ORIGIN").replace(/\/$/, "");
const BACKEND_PUBLIC_URL = requiredEnv("BACKEND_PUBLIC_URL").replace(/\/$/, "");
const FIREBASE_PROJECT_ID = requiredEnv("FIREBASE_PROJECT_ID");
const FIREBASE_SERVICE_ACCOUNT_EMAIL = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || "";
const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = OPENID_NS + "/identifier_select";
const STATE_COOKIE = "rustylub_steam_state";
const EXCHANGE_COLLECTION = "steamAuthExchanges";
const PLATEGA_API_BASE = (process.env.PLATEGA_API_BASE || "https://api.eu.payplatform.cc").replace(/\/+$/, "");
const PLATEGA_MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID || "";
const PLATEGA_SECRET = process.env.PLATEGA_SECRET || "";
const CARBON_SYNC_SECRET = process.env.CARBON_SYNC_SECRET || "";
const VIP_PRICE_RUB = parseVipPrice(process.env.VIP_PRICE_RUB);
const PLATEGA_CONFIGURED = Boolean(PLATEGA_MERCHANT_ID && PLATEGA_SECRET && VIP_PRICE_RUB && CARBON_SYNC_SECRET);

if (process.env.NODE_ENV === "production" &&
    (!FRONTEND_ORIGIN.startsWith("https://") || !BACKEND_PUBLIC_URL.startsWith("https://") || !FIREBASE_SERVICE_ACCOUNT_EMAIL)) {
  throw new Error("Production requires HTTPS URLs and FIREBASE_SERVICE_ACCOUNT_EMAIL for IAM custom-token signing.");
}
if (!getApps().length) initializeApp({
  credential: applicationDefault(),
  projectId: FIREBASE_PROJECT_ID,
  ...(FIREBASE_SERVICE_ACCOUNT_EMAIL ? { serviceAccountId: FIREBASE_SERVICE_ACCOUNT_EMAIL } : {}),
});
const auth = getAuth();
const db = getFirestore();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2kb", type: "application/json" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  if (req.headers.origin === FRONTEND_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  next();
});

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function steamIdFromClaim(claimedId) {
  const match = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId || "");
  if (!match) throw new Error("Invalid Steam claimed_id");
  const id = BigInt(match[1]);
  if (id < 76561197960265728n || id > 76561202255233023n) throw new Error("SteamID64 is out of range");
  return match[1];
}
function buildSteamOpenIdUrl(state) {
  const callback = BACKEND_PUBLIC_URL + "/auth/steam/callback?state=" + encodeURIComponent(state);
  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set("openid.ns", OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", callback);
  url.searchParams.set("openid.realm", BACKEND_PUBLIC_URL);
  url.searchParams.set("openid.identity", IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", IDENTIFIER_SELECT);
  return url.toString();
}
async function verifySteamAssertion(params, expectedState) {
  if (params.get("state") !== expectedState) throw new Error("State mismatch");
  if (params.get("openid.ns") !== OPENID_NS || params.get("openid.mode") !== "id_res") throw new Error("Unexpected OpenID response");
  if (params.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) throw new Error("Unexpected OpenID endpoint");
  const expectedReturnTo = BACKEND_PUBLIC_URL + "/auth/steam/callback?state=" + encodeURIComponent(expectedState);
  if (params.get("openid.return_to") !== expectedReturnTo) throw new Error("Return URL mismatch");
  const claimedId = params.get("openid.claimed_id");
  const identity = params.get("openid.identity");
  const steamId64 = steamIdFromClaim(claimedId);
  if (identity !== claimedId) throw new Error("Identity mismatch");

  const signed = (params.get("openid.signed") || "").split(",");
  for (const field of ["claimed_id", "identity", "return_to", "op_endpoint", "response_nonce", "assoc_handle"]) {
    if (!signed.includes(field)) throw new Error("Required OpenID field is not signed");
  }
  const nonce = params.get("openid.response_nonce") || "";
  const nonceTime = Date.parse(nonce.slice(0, 20));
  if (!Number.isFinite(nonceTime) || Math.abs(Date.now() - nonceTime) > 10 * 60 * 1000) {
    throw new Error("OpenID response nonce is stale");
  }

  const verification = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key.startsWith("openid.") && key !== "openid.mode") verification.append(key, value);
  }
  verification.set("openid.mode", "check_authentication");
  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/plain" },
    body: verification,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Steam assertion verification request failed");
  const body = await response.text();
  if (!/^is_valid:true\s*$/m.test(body)) throw new Error("Steam assertion is not valid");

  // Store each verified nonce once to prevent replay of an otherwise valid assertion.
  await db.collection("steamOpenIdNonces").doc(sha256(nonce)).create({
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
  });
  return steamId64;
}
async function getSteamProfile(steamId64) {
  if (!STEAM_API_KEY) return { displayName: "Steam Player", avatarUrl: "" };
  try {
    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    url.searchParams.set("key", STEAM_API_KEY);
    url.searchParams.set("steamids", steamId64);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Steam profile request failed");
    const json = await response.json();
    const player = json?.response?.players?.[0];
    return {
      displayName: typeof player?.personaname === "string" ? player.personaname.slice(0, 64) : "Steam Player",
      avatarUrl: typeof player?.avatarfull === "string" && player.avatarfull.startsWith("https://") ? player.avatarfull : "",
    };
  } catch {
    return { displayName: "Steam Player", avatarUrl: "" };
  }
}
async function createOrUpdateSteamUser(steamId64) {
  const uid = "steam_" + steamId64;
  const profile = await getSteamProfile(steamId64);
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { displayName: profile.displayName, ...(profile.avatarUrl ? { photoURL: profile.avatarUrl } : {}) });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    try {
      await auth.createUser({ uid, displayName: profile.displayName, ...(profile.avatarUrl ? { photoURL: profile.avatarUrl } : {}) });
    } catch (createError) {
      if (createError?.code !== "auth/uid-already-exists") throw createError;
    }
  }
  const profileRef = db.collection("users").doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    const data = {
      steamId: steamId64,
      steamId64,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl || null,
      authProvider: "steam",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!snapshot.exists) data.createdAt = FieldValue.serverTimestamp();
    transaction.set(profileRef, data, { merge: true });
  });
  return uid;
}
function setStateCookie(res, state) {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  res.setHeader("Set-Cookie", STATE_COOKIE + "=" + encodeURIComponent(state) + "; HttpOnly; " + secure + "SameSite=Lax; Path=/auth/steam; Max-Age=300");
}
function clearStateCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  res.setHeader("Set-Cookie", STATE_COOKIE + "=; HttpOnly; " + secure + "SameSite=Lax; Path=/auth/steam; Max-Age=0");
}
function frontendError(res) {
  clearStateCookie(res);
  return res.redirect(302, FRONTEND_ORIGIN + "/?steamError=verification_failed");
}

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
app.get("/auth/steam", (_req, res) => {
  const state = crypto.randomBytes(32).toString("base64url");
  setStateCookie(res, state);
  res.redirect(302, buildSteamOpenIdUrl(state));
});
app.get("/auth/steam/callback", async (req, res) => {
  const state = parseCookies(req.headers.cookie)[STATE_COOKIE];
  if (!state || typeof req.query.state !== "string" || req.query.state !== state) return frontendError(res);
  try {
    const params = new URL(req.originalUrl, BACKEND_PUBLIC_URL).searchParams;
    const steamId64 = await verifySteamAssertion(params, state);
    const uid = await createOrUpdateSteamUser(steamId64);
    const customToken = await auth.createCustomToken(uid, { provider: "steam", steamId64 });
    const code = crypto.randomBytes(32).toString("base64url");
    await db.collection(EXCHANGE_COLLECTION).doc(sha256(code)).create({
      customToken,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 1000),
    });
    clearStateCookie(res);
    return res.redirect(303, FRONTEND_ORIGIN + "/?steamCode=" + encodeURIComponent(code));
  } catch (error) {
    console.error("Steam sign-in failed:", error?.message || "unknown error");
    return frontendError(res);
  }
});
app.post("/auth/steam/exchange", async (req, res) => {
  if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
  const code = req.body?.code;
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(code)) return res.status(400).json({ error: "invalid_code" });
  const ref = db.collection(EXCHANGE_COLLECTION).doc(sha256(code));
  try {
    const customToken = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      if (!data?.expiresAt || data.expiresAt.toMillis() <= Date.now() || typeof data.customToken !== "string") {
        transaction.delete(ref);
        return null;
      }
      transaction.delete(ref);
      return data.customToken;
    });
    if (!customToken) return res.status(401).json({ error: "code_expired_or_used" });
    return res.status(200).json({ customToken });
  } catch (error) {
    console.error("Steam token exchange failed:", error?.message || "unknown error");
    return res.status(500).json({ error: "exchange_failed" });
  }
});


async function requireSteamUser(req, res, next) {
  const match = /^Bearer\\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!match) return res.status(401).json({ error: "authentication_required" });
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    const steamId64 = decoded.steamId64;
    if (decoded.provider !== "steam" || !isValidSteamId64(steamId64) || decoded.uid !== "steam_" + steamId64) {
      return res.status(403).json({ error: "steam_identity_required" });
    }
    req.steamUser = { uid: decoded.uid, steamId64, displayName: decoded.name || "Steam Player" };
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_session" });
  }
}

async function plategaRequest(path, options = {}) {
  const response = await fetch(PLATEGA_API_BASE + path, {
    ...options,
    headers: {
      "X-MerchantId": PLATEGA_MERCHANT_ID,
      "X-Secret": PLATEGA_SECRET,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Platega request failed with HTTP " + response.status);
    error.status = response.status;
    error.providerCode = typeof payload.code === "string" ? payload.code : undefined;
    throw error;
  }
  return payload;
}

app.get("/vip/config", (_req, res) => {
  res.status(200).json({
    available: PLATEGA_CONFIGURED,
    durationDays: VIP_DURATION_DAYS,
    priceRub: PLATEGA_CONFIGURED ? VIP_PRICE_RUB : null,
    product: "VIP Queue Pass",
  });
});

app.post("/vip/order", requireSteamUser, async (req, res) => {
  if (!PLATEGA_CONFIGURED) return res.status(503).json({ error: "vip_checkout_not_configured" });
  try {
    const orderId = crypto.randomUUID();
    const paymentBody = buildPlategaPaymentBody({
      price: VIP_PRICE_RUB,
      steamId64: req.steamUser.steamId64,
      uid: req.steamUser.uid,
      displayName: req.steamUser.displayName,
      orderId,
      successUrl: FRONTEND_ORIGIN + "/?vip=return",
      failedUrl: FRONTEND_ORIGIN + "/?vip=failed",
    });
    const payment = await plategaRequest("/v2/transaction/process", {
      method: "POST",
      body: JSON.stringify(paymentBody),
    });
    const transactionId = payment.transactionId || payment.id;
    const redirect = payment.redirect;
    if (typeof transactionId !== "string" || typeof redirect !== "string" || new URL(redirect).protocol !== "https:") {
      throw new Error("Platega returned an invalid payment response");
    }
    await db.collection("vipOrders").doc(transactionId).create({
      transactionId,
      orderId,
      uid: req.steamUser.uid,
      steamId64: req.steamUser.steamId64,
      amount: VIP_PRICE_RUB,
      currency: "RUB",
      durationDays: VIP_DURATION_DAYS,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      provider: "platega",
    });
    return res.status(201).json({ redirect, transactionId, status: "pending" });
  } catch (error) {
    console.error("VIP order creation failed:", error?.providerCode || error?.message || "unknown error");
    return res.status(502).json({ error: "payment_creation_failed" });
  }
});

app.get("/vip/me", requireSteamUser, async (req, res) => {
  try {
    const [entitlementSnapshot, ordersSnapshot] = await Promise.all([
      db.collection("vipEntitlements").doc(req.steamUser.steamId64).get(),
      db.collection("vipOrders").where("uid", "==", req.steamUser.uid).limit(20).get(),
    ]);
    const entitlement = entitlementSnapshot.exists ? entitlementSnapshot.data() : null;
    const orders = ordersSnapshot.docs.map((item) => {
      const data = item.data();
      return {
        transactionId: data.transactionId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
      };
    });
    orders.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return res.status(200).json({
      entitlement: entitlement ? {
        status: entitlement.status,
        expiresAt: entitlement.expiresAt?.toDate?.().toISOString() || null,
      } : null,
      orders,
    });
  } catch (error) {
    console.error("VIP account lookup failed:", error?.message || "unknown error");
    return res.status(500).json({ error: "vip_account_unavailable" });
  }
});

app.post("/payments/platega/callback", async (req, res) => {
  if (!PLATEGA_MERCHANT_ID || !PLATEGA_SECRET ||
      !constantTimeSecretMatch(req.headers["x-merchantid"], PLATEGA_MERCHANT_ID) ||
      !constantTimeSecretMatch(req.headers["x-secret"], PLATEGA_SECRET)) {
    return res.sendStatus(401);
  }
  const callback = req.body || {};
  const transactionId = callback.id;
  if (typeof transactionId !== "string" || !/^[0-9a-f-]{36}$/i.test(transactionId) ||
      typeof callback.status !== "string") {
    return res.status(400).json({ error: "invalid_callback" });
  }
  const orderRef = db.collection("vipOrders").doc(transactionId);
  try {
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) return res.status(503).json({ error: "order_not_ready" });
    const order = orderSnapshot.data();
    if (callback.payload !== order.orderId) return res.sendStatus(400);

    // Never trust the callback alone: retrieve the current transaction from Platega.
    const verified = await plategaRequest("/transaction/" + encodeURIComponent(transactionId));
    const verifiedAmount = Number(verified.paymentDetails?.amount);
    const verifiedCurrency = verified.paymentDetails?.currency;
    const verifiedStatus = verified.status;
    if (verified.id && verified.id !== transactionId) return res.sendStatus(400);
    if (verified.payload !== order.orderId) return res.sendStatus(400);

    if (verifiedStatus === "CHARGEBACKED" || verifiedStatus === "PARTIALLY_REFUNDED" || verifiedStatus === "DISPUTED") {
      const paymentRef = db.collection("vipPayments").doc(transactionId);
      const entitlementRef = db.collection("vipEntitlements").doc(order.steamId64);
      await db.runTransaction(async (transaction) => {
        const [paymentSnapshot, entitlementSnapshot] = await Promise.all([
          transaction.get(paymentRef),
          transaction.get(entitlementRef),
        ]);
        transaction.set(orderRef, {
          status: verifiedStatus.toLowerCase(),
          providerUpdatedAt: FieldValue.serverTimestamp(),
          reviewRequired: true,
        }, { merge: true });
        if (paymentSnapshot.exists) transaction.set(paymentRef, {
          status: verifiedStatus.toLowerCase(),
          reviewRequired: true,
          providerUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (entitlementSnapshot.exists) transaction.set(entitlementRef, {
          status: "review_required",
          reviewReason: verifiedStatus.toLowerCase(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      return res.sendStatus(200);
    }
    if (verifiedStatus !== "CONFIRMED") {
      await orderRef.set({
        status: typeof verifiedStatus === "string" ? verifiedStatus.toLowerCase() : "pending",
        providerUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.sendStatus(200);
    }
    if (verifiedAmount !== order.amount || verifiedCurrency !== order.currency ||
        (callback.amount !== undefined && Number(callback.amount) !== order.amount) ||
        (callback.currency !== undefined && callback.currency !== order.currency)) {
      await orderRef.set({ status: "manual_review", reviewReason: "payment_amount_or_currency_mismatch", providerUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.sendStatus(200);
    }

    const paymentRef = db.collection("vipPayments").doc(transactionId);
    const entitlementRef = db.collection("vipEntitlements").doc(order.steamId64);
    const deliveryRef = db.collection("vipDeliveryQueue").doc(transactionId);
    await db.runTransaction(async (transaction) => {
      const [paymentSnapshot, entitlementSnapshot, currentOrderSnapshot] = await Promise.all([
        transaction.get(paymentRef),
        transaction.get(entitlementRef),
        transaction.get(orderRef),
      ]);
      if (!currentOrderSnapshot.exists) throw new Error("VIP order disappeared");
      if (paymentSnapshot.exists) return;
      const now = Date.now();
      const currentExpiry = entitlementSnapshot.data()?.expiresAt?.toMillis?.() || 0;
      const expiresAtMs = nextVipExpiry(now, currentExpiry);
      const startsAtMs = currentExpiry > now ? currentExpiry : now;
      transaction.create(paymentRef, {
        transactionId,
        uid: order.uid,
        steamId64: order.steamId64,
        amount: order.amount,
        currency: order.currency,
        status: "confirmed",
        durationDays: VIP_DURATION_DAYS,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        createdAt: FieldValue.serverTimestamp(),
        deliveryStatus: "pending",
      });
      transaction.set(entitlementRef, {
        uid: order.uid,
        steamId64: order.steamId64,
        status: "pending_delivery",
        startsAt: Timestamp.fromMillis(startsAtMs),
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        lastPaymentId: transactionId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(db.collection("vipExpiryQueue").doc(order.steamId64), {
        steamId64: order.steamId64,
        dueAt: Timestamp.fromMillis(expiresAtMs),
        status: "scheduled",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.create(deliveryRef, {
        type: "grant_vip_queue_skip",
        transactionId,
        steamId64: order.steamId64,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(orderRef, {
        status: "confirmed",
        confirmedAt: FieldValue.serverTimestamp(),
        providerUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    return res.sendStatus(200);
  } catch (error) {
    console.error("Platega callback processing failed:", error?.providerCode || error?.message || "unknown error");
    return res.status(503).json({ error: "callback_processing_failed" });
  }
});


async function requireCarbon(request, response, next) {
  if (!CARBON_SYNC_SECRET) return response.sendStatus(503);
  const authorization = request.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!constantTimeSecretMatch(supplied, CARBON_SYNC_SECRET)) return response.sendStatus(401);
  return next();
}

async function leaseCarbonJob(collectionName, documentId, kind) {
  const ref = db.collection(collectionName).doc(documentId);
  const leaseToken = crypto.randomBytes(24).toString("base64url");
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    const now = Date.now();
    const leaseExpired = data.status === "processing" && (data.leaseUntil?.toMillis?.() || 0) <= now;
    const ready = kind === "grant"
      ? data.status === "pending" || leaseExpired
      : (data.status === "scheduled" || leaseExpired) && (data.dueAt?.toMillis?.() || Infinity) <= now;
    if (!ready) return null;
    if (kind === "grant") {
      const entitlementRef = db.collection("vipEntitlements").doc(data.steamId64);
      const entitlementSnapshot = await transaction.get(entitlementRef);
      const entitlement = entitlementSnapshot.data();
      const expiry = entitlement?.expiresAt?.toMillis?.() || 0;
      if (!entitlementSnapshot.exists || expiry <= now || entitlement.status === "review_required") {
        transaction.set(ref, { status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return null;
      }
    }
    transaction.set(ref, {
      status: "processing",
      leaseToken,
      leaseUntil: Timestamp.fromMillis(now + 60 * 1000),
      attempts: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      id: documentId,
      type: kind,
      steamId64: data.steamId64,
      leaseToken,
    };
  });
}

app.get("/internal/carbon/jobs", requireCarbon, async (_req, res) => {
  try {
    const [pendingGrants, retryingGrants, scheduledExpiries, retryingExpiries] = await Promise.all([
      db.collection("vipDeliveryQueue").where("status", "==", "pending").limit(20).get(),
      db.collection("vipDeliveryQueue").where("status", "==", "processing").limit(20).get(),
      db.collection("vipExpiryQueue").where("status", "==", "scheduled").limit(50).get(),
      db.collection("vipExpiryQueue").where("status", "==", "processing").limit(50).get(),
    ]);
    const now = Date.now();
    const grantDocs = [...pendingGrants.docs, ...retryingGrants.docs];
    const expiryDocs = [...scheduledExpiries.docs, ...retryingExpiries.docs]
      .filter((snapshot) => (snapshot.data().dueAt?.toMillis?.() || Infinity) <= now);
    const jobs = [];
    for (const snapshot of grantDocs) {
      const job = await leaseCarbonJob("vipDeliveryQueue", snapshot.id, "grant");
      if (job) jobs.push(job);
    }
    for (const snapshot of expiryDocs) {
      const job = await leaseCarbonJob("vipExpiryQueue", snapshot.id, "expire");
      if (job) jobs.push(job);
    }
    return res.status(200).json({ jobs });
  } catch (error) {
    console.error("Carbon job polling failed:", error?.message || "unknown error");
    return res.status(503).json({ error: "carbon_queue_unavailable" });
  }
});

app.post("/internal/carbon/ack", requireCarbon, async (req, res) => {
  const { type, id, leaseToken, success, message: jobMessage } = req.body || {};
  if (!["grant", "expire"].includes(type) || typeof id !== "string" ||
      typeof leaseToken !== "string" || typeof success !== "boolean") {
    return res.status(400).json({ error: "invalid_acknowledgement" });
  }
  const collectionName = type === "grant" ? "vipDeliveryQueue" : "vipExpiryQueue";
  const jobRef = db.collection(collectionName).doc(id);
  try {
    await db.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobRef);
      if (!jobSnapshot.exists || jobSnapshot.data().status !== "processing" ||
          jobSnapshot.data().leaseToken !== leaseToken) {
        throw new Error("Carbon job lease is no longer valid");
      }
      const job = jobSnapshot.data();
      const entitlementRef = db.collection("vipEntitlements").doc(job.steamId64);
      const entitlementSnapshot = await transaction.get(entitlementRef);
      const entitlement = entitlementSnapshot.data();
      const now = Date.now();
      if (type === "grant") {
        const paymentRef = db.collection("vipPayments").doc(job.transactionId);
        const paymentSnapshot = await transaction.get(paymentRef);
        if (success && entitlementSnapshot.exists && (entitlement?.expiresAt?.toMillis?.() || 0) > now) {
          transaction.set(entitlementRef, { status: "active", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          if (paymentSnapshot.exists) transaction.set(paymentRef, {
            deliveryStatus: "delivered",
            deliveredAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          transaction.set(jobRef, {
            status: "completed",
            completedAt: FieldValue.serverTimestamp(),
            leaseToken: FieldValue.delete(),
            leaseUntil: FieldValue.delete(),
          }, { merge: true });
        } else if (success) {
          transaction.set(jobRef, {
            status: "expired",
            completedAt: FieldValue.serverTimestamp(),
            leaseToken: FieldValue.delete(),
            leaseUntil: FieldValue.delete(),
          }, { merge: true });
          if (entitlementSnapshot.exists) transaction.set(entitlementRef, {
            status: "expired",
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          transaction.set(jobRef, {
            status: "pending",
            lastError: String(jobMessage || "Carbon grant failed").slice(0, 300),
            leaseToken: FieldValue.delete(),
            leaseUntil: FieldValue.delete(),
          }, { merge: true });
        }
      } else if (success && entitlementSnapshot.exists &&
          (entitlement?.expiresAt?.toMillis?.() || 0) > now) {
        // A renewal may have arrived while the expiry command was in flight.
        // Keep the entitlement and reschedule expiry rather than marking it expired.
        transaction.set(jobRef, {
          status: "scheduled",
          dueAt: entitlement.expiresAt,
          leaseToken: FieldValue.delete(),
          leaseUntil: FieldValue.delete(),
        }, { merge: true });
        transaction.set(entitlementRef, {
          status: "pending_delivery",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        const restoreRef = db.collection("vipDeliveryQueue").doc("restore_" + job.steamId64 + "_" + Date.now());
        transaction.create(restoreRef, {
          type: "grant_vip_queue_skip",
          transactionId: entitlement.lastPaymentId || "renewal",
          steamId64: job.steamId64,
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
        });
      } else if (success) {
        transaction.set(entitlementRef, {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(jobRef, {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          leaseToken: FieldValue.delete(),
          leaseUntil: FieldValue.delete(),
        }, { merge: true });
      } else {
        transaction.set(jobRef, {
          status: "scheduled",
          dueAt: Timestamp.fromMillis(now + 60 * 1000),
          lastError: String(jobMessage || "Carbon expiry failed").slice(0, 300),
          leaseToken: FieldValue.delete(),
          leaseUntil: FieldValue.delete(),
        }, { merge: true });
      }
    });
    return res.sendStatus(200);
  } catch (error) {
    console.error("Carbon job acknowledgement failed:", error?.message || "unknown error");
    return res.status(409).json({ error: "job_lease_conflict" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => console.log("Rusty.Lub Steam auth backend listening on port " + PORT));
}

export { steamIdFromClaim, buildSteamOpenIdUrl, verifySteamAssertion };
