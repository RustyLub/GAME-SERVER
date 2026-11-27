import test from "node:test";
import assert from "node:assert/strict";
import { persistCreatedVipOrder } from "./payment-order.js";

function fakeDatabase() {
  const calls = [];
  return {
    calls,
    runTransaction(callback) {
      return callback({
        get: async (ref) => ({ exists: Boolean(ref.data), data: () => ({ ...ref.data }) }),
        update: (ref, fields) => {
          calls.push(ref.name);
          Object.assign(ref.data, fields);
        },
      });
    },
  };
}

test("commits the order, checkout lock and idempotency redirect in one transaction", async () => {
  const db = fakeDatabase();
  const orderRef = { name: "order", data: { status: "creating" } };
  const orderLockRef = { name: "lock", data: { orderId: "order-1", status: "creating" } };
  const idempotencyRef = { name: "request", data: { orderId: "order-1", status: "creating" } };
  const FieldValue = { serverTimestamp: () => "timestamp" };

  await persistCreatedVipOrder({
    db, orderRef, orderLockRef, idempotencyRef, orderId: "order-1",
    providerTransactionId: "provider-1", providerStatus: "PENDING",
    redirectUrl: "https://pay.platega.io/checkout", paymentMethod: 2, FieldValue,
  });

  assert.deepEqual(db.calls, ["order", "lock", "request"]);
  assert.deepEqual(orderRef.data, {
    status: "pending", provider: "platega", providerTransactionId: "provider-1",
    providerStatus: "PENDING", redirectUrl: "https://pay.platega.io/checkout",
    paymentMethod: 2, updatedAt: "timestamp",
  });
  assert.equal(orderLockRef.data.status, "pending");
  assert.equal(idempotencyRef.data.status, "created");
  assert.equal(idempotencyRef.data.redirectUrl, "https://pay.platega.io/checkout");
});

test("does not partially update records when the idempotency record does not match", async () => {
  const db = fakeDatabase();
  const orderRef = { name: "order", data: { status: "creating" } };
  const orderLockRef = { name: "lock", data: { orderId: "order-1", status: "creating" } };
  const idempotencyRef = { name: "request", data: { orderId: "different-order", status: "creating" } };

  await assert.rejects(persistCreatedVipOrder({
    db, orderRef, orderLockRef, idempotencyRef, orderId: "order-1",
    providerTransactionId: "provider-1", providerStatus: "PENDING",
    redirectUrl: "https://pay.platega.io/checkout", paymentMethod: 2,
    FieldValue: { serverTimestamp: () => "timestamp" },
  }), /idempotency record does not match/);
  assert.deepEqual(db.calls, []);
  assert.equal(orderRef.data.status, "creating");
  assert.equal(orderLockRef.data.status, "creating");
});
