import crypto from "node:crypto";

export const VIP_DURATION_DAYS = 7;
export const VIP_DURATION_MS = VIP_DURATION_DAYS * 24 * 60 * 60 * 1000;

export function parseVipPrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const price = Number(value);
  if (!Number.isSafeInteger(price) || price < 1 || price > 1000000) {
    throw new Error("VIP_PRICE_RUB must be a whole RUB amount between 1 and 1000000.");
  }
  return price;
}

export function constantTimeSecretMatch(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" || !received || !expected) return false;
  const left = Buffer.from(received, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function nextVipExpiry(nowMs, currentExpiryMs) {
  const base = Number.isFinite(currentExpiryMs) && currentExpiryMs > nowMs ? currentExpiryMs : nowMs;
  return base + VIP_DURATION_MS;
}

export function isValidSteamId64(value) {
  if (typeof value !== "string" || !/^\d{17}$/.test(value)) return false;
  const id = BigInt(value);
  return id >= 76561197960265728n && id <= 76561202255233023n;
}

export function buildPlategaPaymentBody({ price, steamId64, uid, displayName, orderId, successUrl, failedUrl }) {
  if (!Number.isSafeInteger(price) || price < 1) throw new Error("Invalid VIP price");
  if (!isValidSteamId64(steamId64) || uid !== "steam_" + steamId64) throw new Error("Invalid Steam identity");
  return {
    paymentDetails: { amount: price, currency: "RUB" },
    description: "Rusty.Lub VIP Queue Pass — 7 days",
    return: successUrl,
    failedUrl,
    payload: orderId,
    metadata: {
      userId: uid,
      userName: String(displayName || "Steam Player").slice(0, 64),
      user_email: steamId64 + "@mail.ru",
    },
  };
}
