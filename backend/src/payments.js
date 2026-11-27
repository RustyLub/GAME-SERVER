import crypto from "node:crypto";

export const PLATEGA_STATUSES = new Set([
  "CONFIRMED",
  "CANCELED",
  "CHARGEBACKED",
  "PARTIALLY_REFUNDED",
  "DISPUTED",
]);

export function constantTimeEqual(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string" || !expected || !actual) return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(actual, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function toMinorUnits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid payment amount");
  return Math.round(amount * 100);
}

export function buildPlategaCreateRequest({
  amount,
  orderId,
  steamId64,
  displayName,
  paymentMethod = 2,
  frontendOrigin,
}) {
  if (!/^\d{17}$/.test(String(steamId64))) throw new Error("Invalid SteamID64");
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) throw new Error("Invalid order ID");
  if (!Number.isInteger(paymentMethod) || ![2, 3, 11, 12, 13, 14].includes(paymentMethod)) {
    throw new Error("Unsupported Platega payment method");
  }
  const origin = new URL(frontendOrigin);
  if (origin.protocol !== "https:" || origin.origin !== frontendOrigin) {
    throw new Error("Invalid frontend origin");
  }
  const safeName = String(displayName || "Rusty.Lub Player").replace(/[^a-zA-Z0-9 _.-]/g, "").slice(0, 64) || "Rusty.Lub Player";
  return {
    paymentMethod,
    paymentDetails: { amount: Number(amount), currency: "RUB" },
    description: "Rusty.Lub VIP Queue Pass — 7 days",
    return: frontendOrigin + "/account?payment=success",
    failedUrl: frontendOrigin + "/store?payment=failed",
    payload: orderId,
    metadata: {
      userId: String(steamId64),
      userName: safeName,
      user_email: String(steamId64) + "@mail.ru",
    },
  };
}

export function validatePlategaTransaction(callback, transaction, order, merchantId) {
  if (!callback || !transaction || !order) throw new Error("Missing payment data");
  if (typeof callback.id !== "string" || callback.id !== transaction.id) throw new Error("Transaction ID mismatch");
  if (!PLATEGA_STATUSES.has(callback.status) || !PLATEGA_STATUSES.has(transaction.status)) throw new Error("Unknown payment status");
  if (callback.payload !== order.id || transaction.payload !== order.id) throw new Error("Order payload mismatch");
  if (toMinorUnits(callback.amount) !== toMinorUnits(order.amount)) throw new Error("Callback amount mismatch");
  if (toMinorUnits(transaction.paymentDetails?.amount) !== toMinorUnits(order.amount)) throw new Error("Provider amount mismatch");
  if (String(callback.currency).toUpperCase() !== String(order.currency).toUpperCase()) throw new Error("Callback currency mismatch");
  if (String(transaction.paymentDetails?.currency).toUpperCase() !== String(order.currency).toUpperCase()) throw new Error("Provider currency mismatch");
  const providerMerchantId = transaction.merchantId || transaction.mechantId;
  if (typeof providerMerchantId !== "string" || providerMerchantId !== merchantId) throw new Error("Merchant ID mismatch");
  return {
    status: transaction.status,
    refundedAmount: Number(transaction.refundedAmount || callback.refundedAmount || 0),
    refundableAmount: Number(transaction.refundableAmount || callback.refundableAmount || 0),
  };
}

export function paymentEventKey(paymentId, status, refundId = "", refundedAmount = "") {
  return crypto.createHash("sha256")
    .update([paymentId, status, refundId, String(refundedAmount)].join("|"))
    .digest("hex");
}

function safeRustNickname(value) {
  return String(value || "Rusty.Lub Player")
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .replace(/["\\]/g, "")
    .slice(0, 32) || "Rusty.Lub Player";
}

export function buildVipGrantCommand(steamId64, nickname) {
  if (!/^\d{17}$/.test(String(steamId64))) throw new Error("Invalid SteamID64");
  return "global.skipqueueid " + steamId64 + ' "' + safeRustNickname(nickname) + '" "Rusty.Lub VIP Queue Pass"';
}

export function buildVipRemoveCommand(steamId64) {
  if (!/^\d{17}$/.test(String(steamId64))) throw new Error("Invalid SteamID64");
  return "global.removeskipqueue " + steamId64;
}

export function isFullyRefunded(refundedAmount, originalAmount) {
  return Number(refundedAmount) > 0 &&
    toMinorUnits(refundedAmount) >= toMinorUnits(originalAmount);
}
