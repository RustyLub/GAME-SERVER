import crypto from "node:crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { isExpectedSchedulerIdentity } from "./scheduler-auth.js";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { buildPlategaCreateRequest, buildVipGrantCommand, buildVipRemoveCommand, constantTimeEqual, isFullyRefunded, paymentEventKey, validatePlategaTransaction, VIP_DURATION_MS, isSafePlategaRedirect } from "./payments.js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function configuredOrigin(name) {
  const value = requiredEnv(name);
  const parsed = new URL(value);
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(name + " must be an origin without a path, query, or credentials.");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(name + " must use HTTPS in production.");
  }
  return parsed.origin;
}

const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = configuredOrigin("FRONTEND_ORIGIN");
const BACKEND_PUBLIC_URL = configuredOrigin("BACKEND_PUBLIC_URL");
const FIREBASE_PROJECT_ID = requiredEnv("FIREBASE_PROJECT_ID");
const FIREBASE_SERVICE_ACCOUNT_EMAIL = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL?.trim() || "";
const STEAM_API_KEY = process.env.STEAM_API_KEY?.trim() || "";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID?.trim() || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET?.trim() || "";
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI?.trim() || (BACKEND_PUBLIC_URL + "/auth/discord/callback");
const DISCORD_STATE_COOKIE = "rustylub_discord_state";
const RCON_HOST = process.env.RCON_HOST?.trim() || "";
const RCON_PORT = Number(process.env.RCON_PORT || 0);
const RCON_PROTOCOL = process.env.RCON_PROTOCOL?.trim() || "wss";
const RCON_PASSWORD = process.env.RCON_PASSWORD || "";
const PLATEGA_API_BASE = process.env.PLATEGA_API_BASE?.trim() || "https://api.eu.payplatform.cc";
const PLATEGA_MERCHANT_ID = process.env.PLATEGA_MERCHANT_ID?.trim() || "";
const PLATEGA_SECRET = process.env.PLATEGA_SECRET || "";
const VIP_PRICE_RUB = Number(process.env.VIP_PRICE_RUB || 0);
const PLATEGA_PAYMENT_METHOD = Number(process.env.PLATEGA_PAYMENT_METHOD || 2);
const VIP_SCHEDULER_SERVICE_ACCOUNT = process.env.VIP_SCHEDULER_SERVICE_ACCOUNT?.trim() || "";
const LEGAL_DETAILS_COMPLETE = process.env.LEGAL_DETAILS_COMPLETE === "true";
const googleAuthClient = new OAuth2Client();


if (process.env.NODE_ENV === "production" && !FIREBASE_SERVICE_ACCOUNT_EMAIL) {
  throw new Error("Production requires FIREBASE_SERVICE_ACCOUNT_EMAIL for IAM custom-token signing.");
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
    ...(FIREBASE_SERVICE_ACCOUNT_EMAIL ? { serviceAccountId: FIREBASE_SERVICE_ACCOUNT_EMAIL } : {}),
  });
}

const auth = getAuth();
const db = getFirestore();
const app = express();
const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = OPENID_NS + "/identifier_select";
const STATE_COOKIE = "rustylub_steam_state";
const EXCHANGE_COLLECTION = "steamAuthExchanges";

app.disable("x-powered-by");
app.use(express.json({ limit: "2kb", type: "application/json" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Vary", "Origin");

  if (req.headers.origin === FRONTEND_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  next();
});

function parseCookies(header = "") {
  const result = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    try {
      result[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore malformed cookie values rather than failing the callback.
    }
  }
  return result;
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
  if (params.get("openid.ns") !== OPENID_NS || params.get("openid.mode") !== "id_res") {
    throw new Error("Unexpected OpenID response");
  }
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

  // Firestore create is atomic: a previously used nonce cannot be replayed.
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
    await auth.updateUser(uid, {
      displayName: profile.displayName,
      ...(profile.avatarUrl ? { photoURL: profile.avatarUrl } : {}),
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    try {
      await auth.createUser({
        uid,
        displayName: profile.displayName,
        ...(profile.avatarUrl ? { photoURL: profile.avatarUrl } : {}),
      });
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


function setDiscordStateCookie(res, state) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", DISCORD_STATE_COOKIE + "=" + encodeURIComponent(state) +
    "; HttpOnly" + secure + "; SameSite=Lax; Path=/auth/discord; Max-Age=300");
}

function clearDiscordStateCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", DISCORD_STATE_COOKIE + "=; HttpOnly" + secure +
    "; SameSite=Lax; Path=/auth/discord; Max-Age=0");
}

async function authenticatedSteamUid(req) {
  try {
    const authorization = req.headers.authorization || "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) throw new Error("unauthorized");
    const decoded = await auth.verifyIdToken(match[1]);
    if (!/^steam_\d{17}$/.test(decoded.uid)) throw new Error("unauthorized");
    return decoded.uid;
  } catch {
    throw new Error("unauthorized");
  }
}

function buildDiscordAuthorizeUrl(state) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", DISCORD_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function sendRconCommand(command, timeoutMs = 5000) {
  if (!RCON_HOST || !Number.isInteger(RCON_PORT) || RCON_PORT < 1 || !RCON_PASSWORD || !["ws", "wss"].includes(RCON_PROTOCOL)) {
    throw new Error("RCON is not configured");
  }
  if (process.env.NODE_ENV === "production" && RCON_PROTOCOL !== "wss") throw new Error("Production RCON must use secure WebSocket (wss)");
  if (typeof WebSocket === "undefined") throw new Error("WebSocket client is unavailable in this Node runtime");
  const identifier = crypto.randomInt(1, 2_000_000_000);
  const socketUrl = RCON_PROTOCOL + "://" + RCON_HOST + ":" + RCON_PORT + "/" + encodeURIComponent(RCON_PASSWORD);
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("RCON command timed out"));
    }, timeoutMs);
    const finish = (error, value) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}
      if (error) reject(error); else resolve(value);
    };
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ Identifier: identifier, Message: command, Name: "Rusty.Lub" }));
    }, { once: true });
    socket.addEventListener("message", (event) => {
      try {
        const response = JSON.parse(String(event.data));
        if (response.Identifier === identifier) finish(null, String(response.Message || ""));
      } catch {
        finish(new Error("Invalid RCON response"));
      }
    });
    socket.addEventListener("error", () => finish(new Error("RCON connection failed")), { once: true });
    socket.addEventListener("close", () => {
      clearTimeout(timer);
    }, { once: true });
  });
}

function parseRustServerInfo(message) {
  let info;
  try { info = typeof message === "string" ? JSON.parse(message) : message; }
  catch { throw new Error("Rust serverinfo response was not JSON"); }
  const players = Number(info?.Players ?? info?.players);
  const maxPlayers = Number(info?.MaxPlayers ?? info?.maxPlayers ?? info?.maxplayers);
  if (!Number.isFinite(players) || !Number.isFinite(maxPlayers) || maxPlayers < 1) {
    throw new Error("Rust serverinfo response did not contain player counts");
  }
  return { online: true, players, maxPlayers };
}

function setStateCookie(res, state) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", STATE_COOKIE + "=" + encodeURIComponent(state) +
    "; HttpOnly" + secure + "; SameSite=Lax; Path=/auth/steam; Max-Age=300");
}

function clearStateCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", STATE_COOKIE + "=; HttpOnly" + secure +
    "; SameSite=Lax; Path=/auth/steam; Max-Age=0");
}

function frontendError(res) {
  clearStateCookie(res);
  return res.redirect(302, FRONTEND_ORIGIN + "/?steamError=verification_failed");
}

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

app.get("/auth/steam", (_req, res) => {
  const state = crypto.randomBytes(32).toString("base64url");
  setStateCookie(res, state);
  return res.redirect(302, buildSteamOpenIdUrl(state));
});

app.get("/auth/steam/callback", async (req, res) => {
  try {
    const state = parseCookies(req.headers.cookie)[STATE_COOKIE];
    if (!state || typeof req.query.state !== "string" || req.query.state !== state) {
      return frontendError(res);
    }
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
  if (!req.is("application/json")) return res.sendStatus(415);

  const code = req.body?.code;
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(code)) {
    return res.status(400).json({ error: "invalid_code" });
  }

  const ref = db.collection(EXCHANGE_COLLECTION).doc(sha256(code));
  try {
    const customToken = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      if (!data?.expiresAt || data.expiresAt.toMillis() <= Date.now() ||
          typeof data.customToken !== "string") {
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


app.post("/auth/discord/start", async (req, res) => {
  if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) return res.status(503).json({ error: "discord_not_configured" });
  try {
    const uid = await authenticatedSteamUid(req);
    const state = crypto.randomBytes(32).toString("base64url");
    await db.collection("discordAuthStates").doc(sha256(state)).create({
      uid,
      expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
    });
    setDiscordStateCookie(res, state);
    return res.status(200).json({ redirectUrl: buildDiscordAuthorizeUrl(state) });
  } catch (error) {
    return res.status(error?.message === "unauthorized" ? 401 : 500).json({ error: "discord_link_start_failed" });
  }
});

app.get("/auth/discord/callback", async (req, res) => {
  const fail = (reason = "link_failed") => {
    clearDiscordStateCookie(res);
    return res.redirect(303, FRONTEND_ORIGIN + "/account?discordError=" + encodeURIComponent(reason));
  };
  try {
    const state = parseCookies(req.headers.cookie)[DISCORD_STATE_COOKIE];
    if (!state || typeof req.query.state !== "string" || req.query.state !== state || typeof req.query.code !== "string") {
      return fail("state_invalid");
    }
    const stateRef = db.collection("discordAuthStates").doc(sha256(state));
    const uid = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef);
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      transaction.delete(stateRef);
      if (!data?.expiresAt || data.expiresAt.toMillis() <= Date.now() || !/^steam_\d{17}$/.test(data.uid || "")) return null;
      return data.uid;
    });
    if (!uid) return fail("state_expired");

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(DISCORD_CLIENT_ID + ":" + DISCORD_CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResponse.ok) return fail("token_exchange_failed");
    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== "string") return fail("token_exchange_failed");

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: "Bearer " + tokenData.access_token, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!userResponse.ok) return fail("profile_fetch_failed");
    const discordUser = await userResponse.json();
    if (!/^\d{17,20}$/.test(String(discordUser.id || "")) || typeof discordUser.username !== "string") {
      return fail("profile_invalid");
    }

    const discordId = String(discordUser.id);
    const profileRef = db.collection("users").doc(uid);
    const linkRef = db.collection("discordLinks").doc(discordId);
    const username = String(discordUser.global_name || discordUser.username).slice(0, 80);
    const avatarUrl = typeof discordUser.avatar === "string"
      ? "https://cdn.discordapp.com/avatars/" + discordId + "/" + discordUser.avatar + ".png?size=128"
      : null;

    await db.runTransaction(async (transaction) => {
      const [profileSnapshot, linkSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(linkRef),
      ]);
      if (linkSnapshot.exists && linkSnapshot.data()?.uid !== uid) throw new Error("discord_already_linked");
      const previousDiscordId = profileSnapshot.data()?.discordId;
      if (previousDiscordId && previousDiscordId !== discordId) {
        const previousRef = db.collection("discordLinks").doc(String(previousDiscordId));
        const previousSnapshot = await transaction.get(previousRef);
        if (previousSnapshot.exists && previousSnapshot.data()?.uid === uid) transaction.delete(previousRef);
      }
      transaction.set(linkRef, { uid, linkedAt: FieldValue.serverTimestamp() });
      transaction.set(profileRef, {
        discordId,
        discordUsername: username,
        discordAvatarUrl: avatarUrl,
        discordLinkedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    clearDiscordStateCookie(res);
    return res.redirect(303, FRONTEND_ORIGIN + "/account?discordLinked=1");
  } catch (error) {
    console.error("Discord account linking failed:", error?.message || "unknown error");
    return fail(error?.message === "discord_already_linked" ? "already_linked" : "link_failed");
  }
});

app.post("/auth/discord/unlink", async (req, res) => {
  if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
  try {
    const uid = await authenticatedSteamUid(req);
    const profileRef = db.collection("users").doc(uid);
    await db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      const discordId = profile.data()?.discordId;
      if (discordId) {
        const linkRef = db.collection("discordLinks").doc(String(discordId));
        const link = await transaction.get(linkRef);
        if (link.exists && link.data()?.uid === uid) transaction.delete(linkRef);
        transaction.update(profileRef, {
          discordId: FieldValue.delete(),
          discordUsername: FieldValue.delete(),
          discordAvatarUrl: FieldValue.delete(),
          discordLinkedAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
});

app.get("/public/server-status", async (_req, res) => {
  try {
    const response = await sendRconCommand("serverinfo", 4500);
    const status = parseRustServerInfo(response);
    res.setHeader("Cache-Control", "public, max-age=20, stale-while-revalidate=10");
    return res.status(200).json(status);
  } catch {
    return res.status(503).json({ online: null, available: false });
  }
});


function isVipCheckoutEnabled() {
  try {
    const api = new URL(PLATEGA_API_BASE);
    return api.protocol === "https:" &&
      ["api.eu.payplatform.cc", "api.payplatform.cc"].includes(api.hostname) &&
      Boolean(LEGAL_DETAILS_COMPLETE && PLATEGA_MERCHANT_ID && PLATEGA_SECRET && VIP_SCHEDULER_SERVICE_ACCOUNT &&
        RCON_HOST && RCON_PORT > 0 && RCON_PASSWORD && RCON_PROTOCOL === "wss" &&
        Number.isInteger(VIP_PRICE_RUB) && VIP_PRICE_RUB > 0 &&
        [2, 3, 11, 12, 13, 14].includes(PLATEGA_PAYMENT_METHOD));
  } catch { return false; }
}

async function plategaRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      "X-MerchantId": PLATEGA_MERCHANT_ID,
      "X-Secret": PLATEGA_SECRET,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Platega API returned HTTP " + response.status);
  return payload;
}

async function processVipEntitlement(entitlementRef) {
  const snapshot = await entitlementRef.get();
  if (!snapshot.exists) return "missing";
  const data = snapshot.data();
  const now = Date.now();
  if (data.status === "active" && data.expiresAt?.toMillis?.() > now) return "active";

  if (data.status === "grant_pending") {
    if (data.expiresAt && data.expiresAt.toMillis() <= now) {
      await entitlementRef.update({ status: "revoke_pending", revokeToStatus: "expired", updatedAt: FieldValue.serverTimestamp() });
      return processVipEntitlement(entitlementRef);
    }
    await sendRconCommand(buildVipGrantCommand(data.steamId64, data.displayName), 7000);
    await sendRconCommand("server.writecfg", 5000);
    await entitlementRef.update({
      status: "active",
      grantedAt: data.grantedAt || FieldValue.serverTimestamp(),
      expiresAt: data.expiresAt || Timestamp.fromMillis(Date.now() + VIP_DURATION_MS),
      updatedAt: FieldValue.serverTimestamp(),
      revokeToStatus: FieldValue.delete(),
    });
    return "active";
  }

  if (data.status === "revoke_pending") {
    await sendRconCommand(buildVipRemoveCommand(data.steamId64), 7000);
    await sendRconCommand("server.writecfg", 5000);
    const targetStatus = data.revokeToStatus === "suspended" && !data.expiresAt ? "revoked" : (["expired", "suspended", "revoked"].includes(data.revokeToStatus) ? data.revokeToStatus : "expired");
    await entitlementRef.update({
      status: targetStatus,
      revokedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      revokeToStatus: FieldValue.delete(),
    });
    return targetStatus;
  }
  return data.status || "unknown";
}

async function processVipQueueWorker() {
  const pending = await db.collection("entitlements").where("status", "in", ["grant_pending", "revoke_pending"]).limit(100).get();
  const expired = await db.collection("entitlements").where("status", "==", "active")
    .where("expiresAt", "<=", Timestamp.now()).limit(100).get();
  const staleOrders = await db.collection("orders").where("status", "in", ["creating", "pending"])
    .where("expiresAt", "<=", Timestamp.now()).limit(100).get();
  const suspendedExpired = await db.collection("entitlements").where("status", "==", "suspended")
    .where("expiresAt", "<=", Timestamp.now()).limit(100).get();
  let processed = 0;
  for (const doc of pending.docs) {
    await processVipEntitlement(doc.ref);
    processed += 1;
  }
  for (const suspendedDoc of suspendedExpired.docs) {
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(suspendedDoc.ref);
      if (!current.exists || current.data()?.status !== "suspended" ||
          current.data()?.expiresAt?.toMillis?.() > Date.now()) return;
      transaction.update(suspendedDoc.ref, {
        status: "expired",
        expiredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    processed += 1;
  }
  for (const orderDoc of staleOrders.docs) {
    const orderLockRef = db.collection("paymentLocks").doc(orderDoc.data()?.userId || "");
    await db.runTransaction(async (transaction) => {
      const [currentOrder, lock] = await Promise.all([transaction.get(orderDoc.ref), transaction.get(orderLockRef)]);
      if (!currentOrder.exists || !["creating", "pending"].includes(currentOrder.data()?.status) ||
          currentOrder.data()?.expiresAt?.toMillis?.() > Date.now()) return;
      transaction.update(orderDoc.ref, { status: "expired", updatedAt: FieldValue.serverTimestamp() });
      if (lock.exists && lock.data()?.orderId === orderDoc.id) {
        transaction.update(orderLockRef, { status: "expired", expiresAt: Timestamp.fromMillis(Date.now()), updatedAt: FieldValue.serverTimestamp() });
      }
    });
    processed += 1;
  }
  for (const doc of expired.docs) {
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(doc.ref);
      if (!current.exists || current.data()?.status !== "active" ||
          current.data()?.expiresAt?.toMillis?.() > Date.now()) return;
      transaction.update(doc.ref, {
        status: "revoke_pending",
        revokeToStatus: "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await processVipEntitlement(doc.ref);
    processed += 1;
  }
  return processed;
}

app.get("/vip/config", (_req, res) => res.status(200).json({
  enabled: isVipCheckoutEnabled(),
  price: Number.isInteger(VIP_PRICE_RUB) && VIP_PRICE_RUB > 0 ? VIP_PRICE_RUB : null,
  currency: "RUB",
  durationDays: 7,
}));

app.get("/vip/me", async (req, res) => {
  if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
  try {
    const uid = await authenticatedSteamUid(req);
    const snapshot = await db.collection("entitlements").where("userId", "==", uid).limit(10).get();
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, status: data.status || "unknown", expiresAt: data.expiresAt?.toDate?.().toISOString() || null };
    }).sort((a, b) => String(b.expiresAt || "").localeCompare(String(a.expiresAt || "")));
    return res.status(200).json({ entitlement: items[0] || null });
  } catch { return res.status(401).json({ error: "unauthorized" }); }
});

app.post("/payments/orders", async (req, res) => {
  if (req.headers.origin !== FRONTEND_ORIGIN) return res.sendStatus(403);
  if (!req.is("application/json")) return res.sendStatus(415);
  if (!isVipCheckoutEnabled()) return res.status(503).json({ error: "vip_checkout_not_configured" });
  try {
    const uid = await authenticatedSteamUid(req);
    const steamId64 = uid.slice("steam_".length);
    const requestId = req.body?.requestId;
    if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) return res.status(400).json({ error: "invalid_request_id" });

    const entitlements = await db.collection("entitlements").where("userId", "==", uid).limit(20).get();
    const active = entitlements.docs.some((doc) => {
      const item = doc.data();
      return ["grant_pending", "revoke_pending", "suspended"].includes(item.status) ||
        (item.status === "active" && item.expiresAt?.toMillis?.() > Date.now());
    });
    if (active) return res.status(409).json({ error: "vip_already_active" });
    const recentOrders = await db.collection("orders").where("userId", "==", uid).limit(20).get();
    const pendingOrder = recentOrders.docs.some((doc) => {
      const item = doc.data();
      return ["creating", "pending"].includes(item.status) && item.expiresAt?.toMillis?.() > Date.now();
    });
    if (pendingOrder) return res.status(409).json({ error: "payment_already_pending" });

    const profile = await db.collection("users").doc(uid).get();
    const displayName = String(profile.data()?.customDisplayName || profile.data()?.displayName || "Rusty.Lub Player").slice(0, 64);
    const orderId = crypto.randomUUID();
    const orderRef = db.collection("orders").doc(orderId);
    const idempotencyRef = db.collection("paymentRequests").doc(sha256(uid + ":" + requestId));
    const orderLockRef = db.collection("paymentLocks").doc(uid);
    const reservation = await db.runTransaction(async (transaction) => {
      const [existing, lock] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(orderLockRef),
      ]);
      if (existing.exists) return { existing: true, ...existing.data() };
      if (lock.exists) {
        const lockData = lock.data();
        if (lockData.expiresAt?.toMillis?.() > Date.now()) {
          return { locked: true };
        }
      }

      const expiresAt = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
      transaction.create(idempotencyRef, { userId: uid, orderId, status: "creating", createdAt: FieldValue.serverTimestamp() });
      transaction.create(orderRef, {
        userId: uid, steamId64, displayName, product: "vip_queue_pass_7d",
        amount: VIP_PRICE_RUB, currency: "RUB", status: "creating",
        createdAt: FieldValue.serverTimestamp(), expiresAt,
      });
      transaction.set(orderLockRef, {
        userId: uid, orderId, status: "creating", expiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { existing: false, orderId, status: "creating" };
    });
    if (reservation.locked) return res.status(409).json({ error: "payment_already_pending" });
    if (reservation.existing) {
      if (reservation.redirectUrl) return res.status(200).json({ orderId: reservation.orderId, redirectUrl: reservation.redirectUrl });
      return res.status(409).json({ error: "order_creation_in_progress" });
    }

    const createRequest = buildPlategaCreateRequest({
      amount: VIP_PRICE_RUB, orderId, steamId64, displayName,
      paymentMethod: PLATEGA_PAYMENT_METHOD, frontendOrigin: FRONTEND_ORIGIN,
    });
    try {
      const providerResponse = await plategaRequest(PLATEGA_API_BASE.replace(/\/$/, "") + "/transaction/process", {
        method: "POST", body: JSON.stringify(createRequest),
      });
      if (!isSafePlategaRedirect(providerResponse.redirect)) throw new Error("Unsafe Platega redirect URL");
      const redirectUrl = new URL(providerResponse.redirect);
      if (typeof providerResponse.transactionId !== "string" || !/^[0-9a-f-]{36}$/i.test(providerResponse.transactionId)) {
        throw new Error("Invalid Platega transaction ID");
      }
      await db.runTransaction(async (transaction) => {
        const [currentOrder, currentLock] = await Promise.all([
          transaction.get(orderRef), transaction.get(orderLockRef),
        ]);
        if (!currentOrder.exists || currentOrder.data()?.status !== "creating") {
          throw new Error("Order is no longer in the creating state");
        }
        transaction.update(orderRef, {
          status: "pending", provider: "platega", providerTransactionId: providerResponse.transactionId,
          providerStatus: providerResponse.status || "PENDING", redirectUrl: redirectUrl.toString(),
          paymentMethod: PLATEGA_PAYMENT_METHOD, updatedAt: FieldValue.serverTimestamp(),
        });
        if (currentLock.exists && currentLock.data()?.orderId === orderId) {
          transaction.update(orderLockRef, { status: "pending", updatedAt: FieldValue.serverTimestamp() });
        }
      });
      await idempotencyRef.update({ status: "created", redirectUrl: redirectUrl.toString(), updatedAt: FieldValue.serverTimestamp() });
      return res.status(201).json({ orderId, redirectUrl: redirectUrl.toString(), amount: VIP_PRICE_RUB, currency: "RUB" });
    } catch (error) {
      await orderRef.update({ status: "creation_failed", updatedAt: FieldValue.serverTimestamp() });
      await idempotencyRef.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() });
      await db.runTransaction(async (transaction) => {
        const lock = await transaction.get(orderLockRef);
        if (lock.exists && lock.data()?.orderId === orderId) {
          transaction.update(orderLockRef, {
            status: "failed", expiresAt: Timestamp.fromMillis(Date.now()),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
      console.error("Platega order creation failed:", error?.message || "unknown error");
      return res.status(502).json({ error: "payment_creation_failed" });
    }
  } catch (error) {
    return res.status(error?.message === "unauthorized" ? 401 : 500).json({ error: "order_creation_failed" });
  }
});

app.post("/payments/platega/callback", async (req, res) => {
  if (!PLATEGA_MERCHANT_ID || !PLATEGA_SECRET) return res.sendStatus(503);
  if (!constantTimeEqual(PLATEGA_MERCHANT_ID, String(req.headers["x-merchantid"] || "")) ||
      !constantTimeEqual(PLATEGA_SECRET, String(req.headers["x-secret"] || ""))) return res.sendStatus(401);
  const callback = req.body;
  if (!callback || typeof callback.id !== "string" || typeof callback.payload !== "string") {
    return res.status(400).json({ error: "invalid_callback" });
  }
  try {
    const orderRef = db.collection("orders").doc(callback.payload);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) return res.sendStatus(404);
    const order = { id: orderSnapshot.id, ...orderSnapshot.data() };
    if (order.provider !== "platega" || order.providerTransactionId !== callback.id) return res.sendStatus(409);

    const providerTransaction = await plategaRequest(
      PLATEGA_API_BASE.replace(/\/$/, "") + "/transaction/" + encodeURIComponent(callback.id),
      { method: "GET" },
    );
    const verified = validatePlategaTransaction(callback, providerTransaction, order, PLATEGA_MERCHANT_ID);
    const status = verified.status;
    const fullyRefunded = isFullyRefunded(verified.refundedAmount, order.amount);
    const eventRef = db.collection("paymentEvents").doc(paymentEventKey(callback.id, status, callback.refundId || "", verified.refundedAmount));
    const entitlementRef = db.collection("entitlements").doc(order.id);
    const orderLockRef = db.collection("paymentLocks").doc(order.userId);

    await db.runTransaction(async (transaction) => {
      const [currentOrder, eventSnapshot, entitlementSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(orderRef), transaction.get(eventRef), transaction.get(entitlementRef), transaction.get(orderLockRef),
      ]);
      if (!currentOrder.exists) throw new Error("Order disappeared during callback processing");
      if (eventSnapshot.exists && currentOrder.data()?.lastProviderStatus === status) return;
      if (!eventSnapshot.exists) transaction.create(eventRef, {
        orderId: order.id, providerTransactionId: callback.id, providerStatus: status,
        refundId: callback.refundId || null, receivedAt: FieldValue.serverTimestamp(),
      });
      const orderStatus = status === "CONFIRMED" ? "paid"
        : status === "CANCELED" ? "canceled"
        : status === "DISPUTED" ? "disputed"
        : status === "CHARGEBACKED" ? "chargebacked"
        : fullyRefunded ? "refunded" : "partially_refunded";
      transaction.update(orderRef, {
        status: orderStatus, lastProviderStatus: status,
        refundedAmount: verified.refundedAmount, updatedAt: FieldValue.serverTimestamp(),
      });
      if (lockSnapshot.exists && lockSnapshot.data()?.orderId === order.id) {
        transaction.update(orderLockRef, {
          status: orderStatus,
          expiresAt: Timestamp.fromMillis(Date.now()),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (status === "CONFIRMED") {
        if (!entitlementSnapshot.exists) {
          transaction.create(entitlementRef, {
            userId: order.userId, orderId: order.id, steamId64: order.steamId64,
            displayName: order.displayName, status: "grant_pending",
            createdAt: FieldValue.serverTimestamp(),
          });
        } else {
          const currentEntitlement = entitlementSnapshot.data();
          const disputeResolvedBeforeFirstGrant = currentEntitlement.status === "revoked" &&
            !currentEntitlement.expiresAt && currentOrder.data()?.lastProviderStatus === "DISPUTED";
          if (disputeResolvedBeforeFirstGrant ||
              (["suspended", "revoke_pending"].includes(currentEntitlement.status) &&
                (currentEntitlement.status === "suspended" || currentEntitlement.revokeToStatus === "suspended") &&
                (!currentEntitlement.expiresAt || currentEntitlement.expiresAt.toMillis() > Date.now()))) {
            transaction.update(entitlementRef, { status: "grant_pending", updatedAt: FieldValue.serverTimestamp() });
          }
        }
      } else if (status === "DISPUTED" || status === "CHARGEBACKED" || (status === "PARTIALLY_REFUNDED" && fullyRefunded)) {
        if (entitlementSnapshot.exists && ["active", "grant_pending", "suspended", "revoke_pending"].includes(entitlementSnapshot.data()?.status)) {
          transaction.update(entitlementRef, {
            status: "revoke_pending",
            revokeToStatus: status === "DISPUTED" ? "suspended" : "revoked",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    const entitlement = await entitlementRef.get();
    if (entitlement.exists && ["grant_pending", "revoke_pending"].includes(entitlement.data()?.status)) {
      await processVipEntitlement(entitlementRef);
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error("Platega callback processing failed:", error?.message || "unknown error");
    return res.status(500).json({ error: "callback_processing_failed" });
  }
});

async function isVipSchedulerRequest(req) {
  if (!VIP_SCHEDULER_SERVICE_ACCOUNT) return false;
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
  if (!match) return false;
  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: match[1],
      audience: BACKEND_PUBLIC_URL + "/internal/vip/reconcile",
    });
    const payload = ticket.getPayload();
    return isExpectedSchedulerIdentity(payload, VIP_SCHEDULER_SERVICE_ACCOUNT);
  } catch { return false; }
}

app.post("/internal/vip/reconcile", async (req, res) => {
  if (!await isVipSchedulerRequest(req)) return res.sendStatus(401);
  try {
    const processed = await processVipQueueWorker();
    return res.status(200).json({ ok: true, processed });
  } catch (error) {
    console.error("VIP queue worker failed:", error?.message || "unknown error");
    return res.status(503).json({ ok: false, error: "vip_worker_failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("Rusty.Lub Steam auth backend listening on port " + PORT);
  });
}

export { app, parseCookies, sha256, steamIdFromClaim, buildSteamOpenIdUrl, verifySteamAssertion, buildDiscordAuthorizeUrl, parseRustServerInfo, sendRconCommand, processVipEntitlement, processVipQueueWorker, isVipCheckoutEnabled, isVipSchedulerRequest };
