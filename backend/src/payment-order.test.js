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

function validRecords() {
  const expiresAt = { toMillis: () => Date.now() + 60_000 };
  return {
    orderRef: { name: "order", data: { status: "creating", userId: "user-1", expiresAt } },
    orderLockRef: { name: "lock", data: { orderId: "order-1", userId: "user-1", status: "creating", expiresAt } },
    idempotencyRef: { name: "request", data: { orderId: "order-1", userId: "user-1", status: "creating" } },
  };
}

async function persist(db, records) {
  return persistCreatedVipOrder({
    db, ...records, orderId: "order-1",
    providerTransactionId: "provider-1", providerStatus: "PENDING",
    redirectUrl: "https://pay.platega.io/checkout", paymentMethod: 2,
    FieldValue: { serverTimestamp: () => "timestamp" },
  });
}

test("commits the order, checkout lock and idempotency redirect in one transaction", async () => {
  const db = fakeDatabase();
  const records = validRecords();

  await persist(db, records);

  assert.deepEqual(db.calls, ["order", "lock", "request"]);
  assert.equal(records.orderRef.data.status, "pending");
  assert.equal(records.orderRef.data.provider, "platega");
  assert.equal(records.orderRef.data.providerTransactionId, "provider-1");
  assert.equal(records.orderRef.data.redirectUrl, "https://pay.platega.io/checkout");
  assert.equal(records.orderLockRef.data.status, "pending");
  assert.equal(records.idempotencyRef.data.status, "created");
  assert.equal(records.idempotencyRef.data.redirectUrl, "https://pay.platega.io/checkout");
});

test("does not partially update records when the idempotency record does not match", async () => {
  const db = fakeDatabase();
  const records = validRecords();
  records.idempotencyRef.data.orderId = "different-order";

  await assert.rejects(persist(db, records), /idempotency record does not match/);
  assert.deepEqual(db.calls, []);
  assert.equal(records.orderRef.data.status, "creating");
  assert.equal(records.orderLockRef.data.status, "creating");
});

test("does not persist a provider redirect without the matching live checkout lock", async () => {
  const invalidLocks = [
    null,
    { orderId: "different-order", userId: "user-1", status: "creating", expiresAt: { toMillis: () => Date.now() + 60_000 } },
    { orderId: "order-1", userId: "user-1", status: "pending", expiresAt: { toMillis: () => Date.now() + 60_000 } },
    { orderId: "order-1", userId: "user-1", status: "creating", expiresAt: { toMillis: () => Date.now() - 1 } },
    { orderId: "order-1", userId: "different-user", status: "creating", expiresAt: { toMillis: () => Date.now() + 60_000 } },
  ];
  for (const lock of invalidLocks) {
    const db = fakeDatabase();
    const records = validRecords();
    records.orderLockRef.data = lock;
    await assert.rejects(persist(db, records), /Checkout lock is no longer reserved/);
    assert.deepEqual(db.calls, []);
    assert.equal(records.orderRef.data.status, "creating");
    assert.equal(records.idempotencyRef.data.status, "creating");
  }
});

test("rejects expired order reservations and non-creating idempotency records", async () => {
  const expiredDb = fakeDatabase();
  const expired = validRecords();
  expired.orderRef.data.expiresAt = { toMillis: () => Date.now() - 1 };
  await assert.rejects(persist(expiredDb, expired), /Order reservation has expired/);
  assert.deepEqual(expiredDb.calls, []);

  const failedDb = fakeDatabase();
  const failed = validRecords();
  failed.idempotencyRef.data.status = "failed";
  await assert.rejects(persist(failedDb, failed), /idempotency record does not match/);
  assert.deepEqual(failedDb.calls, []);
});
