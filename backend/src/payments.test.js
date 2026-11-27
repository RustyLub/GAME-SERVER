import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlategaCreateRequest,
  buildVipGrantCommand,
  buildVipRemoveCommand,
  constantTimeEqual,
  isFullyRefunded,
  paymentEventKey,
  toMinorUnits,
  validatePlategaTransaction,
  VIP_DURATION_MS,
} from "./payments.js";

const steamId64 = "76561198000000000";
const orderId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const order = { id: orderId, amount: 149, currency: "RUB" };
const callback = { id: "0c3f6d50-9f4a-4f62-8b47-3c9b9d0c0f11", amount: 149, currency: "RUB", status: "CONFIRMED", payload: orderId };
const transaction = {
  id: callback.id,
  status: "CONFIRMED",
  paymentDetails: { amount: 149, currency: "RUB" },
  merchantId: "merchant-test",
  payload: orderId,
  refundedAmount: 0,
};

test("Platega credentials are compared without timing-safe length errors", () => {
  assert.equal(constantTimeEqual("secret", "secret"), true);
  assert.equal(constantTimeEqual("secret", "secreT"), false);
  assert.equal(constantTimeEqual("secret", "short"), false);
  assert.equal(constantTimeEqual("", "secret"), false);
});

test("VIP Queue Pass duration is exactly seven days", () => {
  assert.equal(VIP_DURATION_MS, 7 * 24 * 60 * 60 * 1000);
});

test("converts RUB amounts to integer minor units", () => {
  assert.equal(toMinorUnits(149), 14900);
  assert.equal(toMinorUnits(12.34), 1234);
  assert.throws(() => toMinorUnits(0));
  assert.throws(() => toMinorUnits("not-a-price"));
});

test("builds Platega request with stable Steam buyer metadata", () => {
  const request = buildPlategaCreateRequest({
    amount: 149,
    orderId,
    steamId64,
    displayName: "Rust Player",
    paymentMethod: 2,
    frontendOrigin: "https://rusty-lub.online",
  });
  assert.equal(request.paymentDetails.amount, 149);
  assert.equal(request.paymentDetails.currency, "RUB");
  assert.equal(request.payload, orderId);
  assert.equal(request.metadata.userId, steamId64);
  assert.equal(request.metadata.user_email, steamId64 + "@mail.ru");
  assert.equal(request.paymentMethod, 2);
});

test("rejects non-HTTPS frontend origins and unsupported payment methods", () => {
  assert.throws(() => buildPlategaCreateRequest({
    amount: 149, orderId, steamId64, frontendOrigin: "http://rusty-lub.online",
  }));
  assert.throws(() => buildPlategaCreateRequest({
    amount: 149, orderId, steamId64, paymentMethod: 99, frontendOrigin: "https://rusty-lub.online",
  }));
});

test("validates callback and authoritative transaction against the stored order", () => {
  assert.deepEqual(validatePlategaTransaction(callback, transaction, order, "merchant-test"), {
    status: "CONFIRMED",
    refundedAmount: 0,
    refundableAmount: 0,
  });
});

test("rejects mismatched order, amount, currency, merchant and provider transaction", () => {
  assert.throws(() => validatePlategaTransaction({ ...callback, payload: "another-order" }, transaction, order, "merchant-test"), /payload/);
  assert.throws(() => validatePlategaTransaction({ ...callback, amount: 148 }, transaction, order, "merchant-test"), /amount/);
  assert.throws(() => validatePlategaTransaction({ ...callback, currency: "USD" }, transaction, order, "merchant-test"), /currency/);
  assert.throws(() => validatePlategaTransaction(callback, { ...transaction, merchantId: "wrong" }, order, "merchant-test"), /Merchant ID/);
  assert.throws(() => validatePlategaTransaction(callback, { ...transaction, id: "wrong" }, order, "merchant-test"), /Transaction ID/);
});

test("accepts the provider's documented legacy mechantId field", () => {
  const { merchantId, ...legacy } = transaction;
  assert.equal(validatePlategaTransaction(callback, { ...legacy, mechantId: "merchant-test" }, order, "merchant-test").status, "CONFIRMED");
});

test("deduplicates callbacks by transaction, status and refund identity", () => {
  assert.equal(paymentEventKey("payment", "CONFIRMED"), paymentEventKey("payment", "CONFIRMED"));
  assert.notEqual(paymentEventKey("payment", "CONFIRMED"), paymentEventKey("payment", "DISPUTED"));
  assert.notEqual(paymentEventKey("payment", "PARTIALLY_REFUNDED", "refund-a"), paymentEventKey("payment", "PARTIALLY_REFUNDED", "refund-b"));
});

test("builds only validated native Rust queue commands", () => {
  assert.equal(
    buildVipGrantCommand(steamId64, 'Player "admin"\n'),
    'global.skipqueueid ' + steamId64 + ' "Player admin" "Rusty.Lub VIP Queue Pass"',
  );
  assert.equal(buildVipRemoveCommand(steamId64), "global.removeskipqueue " + steamId64);
  assert.throws(() => buildVipGrantCommand("invalid", "player"));
  assert.throws(() => buildVipRemoveCommand("invalid"));
});

test("detects a full refund without treating partial refunds as full", () => {
  assert.equal(isFullyRefunded(149, 149), true);
  assert.equal(isFullyRefunded(25, 149), false);
  assert.equal(isFullyRefunded(0, 149), false);
});
