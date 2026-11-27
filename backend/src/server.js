import crypto from "node:crypto";
import express from "express";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = requiredEnv("FRONTEND_ORIGIN").replace(/\/$/, "");
const BACKEND_PUBLIC_URL = requiredEnv("BACKEND_PUBLIC_URL").replace(/\/$/, "");
const FIREBASE_PROJECT_ID = requiredEnv("FIREBASE_PROJECT_ID");
const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = OPENID_NS + "/identifier_select";
const STATE_COOKIE = "rustylub_steam_state";
const EXCHANGE_COLLECTION = "steamAuthExchanges";

if (process.env.NODE_ENV === "production" &&
    (!FRONTEND_ORIGIN.startsWith("https://") || !BACKEND_PUBLIC_URL.startsWith("https://"))) {
  throw new Error("FRONTEND_ORIGIN and BACKEND_PUBLIC_URL must use HTTPS in production.");
}
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: FIREBASE_PROJECT_ID });
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
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => console.log("Rusty.Lub Steam auth backend listening on port " + PORT));
}

export { steamIdFromClaim, buildSteamOpenIdUrl, verifySteamAssertion };
