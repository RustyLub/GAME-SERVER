import test from "node:test";
import assert from "node:assert/strict";
import { createVipEntitlementProcessor } from "./vip-entitlement.js";

const DELETE = Symbol("delete");
const DURATION = 7 * 24 * 60 * 60 * 1000;
const steamId64 = "76561198000000000";

class FakeDatabase {
  tail = Promise.resolve();

  runTransaction(callback) {
    const operation = this.tail.then(() => callback({
      get: async (ref) => ({
        exists: Boolean(ref.data),
        data: () => ({ ...ref.data }),
      }),
      update: (ref, fields) => {
        for (const [key, value] of Object.entries(fields)) {
          if (value === DELETE) delete ref.data[key];
          else ref.data[key] = value;
        }
      },
    }));
    this.tail = operation.catch(() => {});
    return operation;
  }
}

function createProcessor({ db = new FakeDatabase(), ref, now = () => 1000, sendRconCommand, leaseMs = 30_000 } = {}) {
  const FieldValue = {
    delete: () => DELETE,
    serverTimestamp: () => new Date(now()),
  };
  const Timestamp = {
    fromMillis: (value) => ({ toMillis: () => value }),
  };
  let tokenNumber = 0;
  const processor = createVipEntitlementProcessor({
    db,
    FieldValue,
    Timestamp,
    sendRconCommand: sendRconCommand || (async () => ""),
    buildVipGrantCommand: (id) => "grant:" + id,
    buildVipRemoveCommand: (id) => "remove:" + id,
    durationMs: DURATION,
    now,
    createToken: () => "processing-" + (++tokenNumber),
    leaseMs,
  });
  return { processor, db };
}

test("serializes a grant and a newer revocation, then reconciles the newer state", async () => {
  const ref = { data: { status: "grant_pending", steamId64, displayName: "Player" } };
  const commands = [];
  let releaseGrant;
  let markGrantStarted;
  const grantStarted = new Promise((resolve) => { markGrantStarted = resolve; });
  const { processor, db } = createProcessor({
    ref,
    sendRconCommand: async (command) => {
      commands.push(command);
      if (command === "grant:" + steamId64) {
        markGrantStarted();
        await new Promise((resolve) => { releaseGrant = resolve; });
      }
    },
  });

  const first = processor(ref);
  await grantStarted;
  assert.equal(await processor(ref), "processing");

  await db.runTransaction(async (transaction) => {
    transaction.update(ref, { status: "revoke_pending", revokeToStatus: "revoked" });
  });
  releaseGrant();

  assert.equal(await first, "revoked");
  assert.equal(ref.data.status, "revoked");
  assert.equal(ref.data.processingToken, undefined);
  assert.equal(ref.data.processingUntil, undefined);
  assert.deepEqual(commands, [
    "grant:" + steamId64,
    "server.writecfg",
    "remove:" + steamId64,
    "server.writecfg",
  ]);
});

test("finishes a newer grant after an older revocation command", async () => {
  const ref = { data: { status: "revoke_pending", revokeToStatus: "revoked", steamId64, displayName: "Player" } };
  const commands = [];
  let releaseRevoke;
  let markRevokeStarted;
  const revokeStarted = new Promise((resolve) => { markRevokeStarted = resolve; });
  const { processor, db } = createProcessor({
    ref,
    sendRconCommand: async (command) => {
      commands.push(command);
      if (command === "remove:" + steamId64) {
        markRevokeStarted();
        await new Promise((resolve) => { releaseRevoke = resolve; });
      }
    },
  });

  const first = processor(ref);
  await revokeStarted;
  assert.equal(await processor(ref), "processing");

  await db.runTransaction(async (transaction) => {
    transaction.update(ref, { status: "grant_pending" });
  });
  releaseRevoke();

  assert.equal(await first, "active");
  assert.equal(ref.data.status, "active");
  assert.equal(ref.data.expiresAt.toMillis(), 1000 + DURATION);
  assert.deepEqual(commands, [
    "remove:" + steamId64,
    "server.writecfg",
    "grant:" + steamId64,
    "server.writecfg",
  ]);
});

test("reclaims a pending operation after its processing lease expires", async () => {
  let currentTime = 1000;
  const ref = {
    data: {
      status: "grant_pending",
      steamId64,
      displayName: "Player",
      processingToken: "abandoned",
      processingUntil: { toMillis: () => 2000 },
    },
  };
  const commands = [];
  const { processor } = createProcessor({
    ref,
    now: () => currentTime,
    sendRconCommand: async (command) => { commands.push(command); },
  });

  assert.equal(await processor(ref), "processing");
  assert.deepEqual(commands, []);
  currentTime = 2001;
  assert.equal(await processor(ref), "active");
  assert.equal(ref.data.status, "active");
  assert.equal(ref.data.expiresAt.toMillis(), currentTime + DURATION);
  assert.equal(ref.data.processingToken, undefined);
});

test("converts an already-expired pending grant into a revocation", async () => {
  const ref = {
    data: {
      status: "grant_pending",
      steamId64,
      displayName: "Player",
      expiresAt: { toMillis: () => 999 },
    },
  };
  const commands = [];
  const { processor } = createProcessor({
    ref,
    sendRconCommand: async (command) => { commands.push(command); },
  });

  assert.equal(await processor(ref), "expired");
  assert.equal(ref.data.status, "expired");
  assert.deepEqual(commands, ["remove:" + steamId64, "server.writecfg"]);
});

test("revokes a grant that expires while its RCON command is in flight", async () => {
  let currentTime = 1000;
  const ref = {
    data: {
      status: "grant_pending",
      steamId64,
      displayName: "Player",
      expiresAt: { toMillis: () => 2000 },
    },
  };
  const commands = [];
  let releaseGrant;
  let markGrantStarted;
  const grantStarted = new Promise((resolve) => { markGrantStarted = resolve; });
  const { processor } = createProcessor({
    ref,
    now: () => currentTime,
    sendRconCommand: async (command) => {
      commands.push(command);
      if (command === "grant:" + steamId64) {
        markGrantStarted();
        await new Promise((resolve) => { releaseGrant = resolve; });
      }
    },
  });

  const pending = processor(ref);
  await grantStarted;
  currentTime = 2001;
  releaseGrant();

  assert.equal(await pending, "expired");
  assert.equal(ref.data.status, "expired");
  assert.deepEqual(commands, [
    "grant:" + steamId64,
    "server.writecfg",
    "remove:" + steamId64,
    "server.writecfg",
  ]);
});

test("releases the lease after an RCON failure so the scheduler can retry immediately", async () => {
  const ref = { data: { status: "grant_pending", steamId64, displayName: "Player" } };
  let fail = true;
  const { processor } = createProcessor({
    ref,
    sendRconCommand: async (command) => {
      if (command === "grant:" + steamId64 && fail) {
        fail = false;
        throw new Error("RCON unavailable");
      }
    },
  });

  await assert.rejects(processor(ref), /RCON unavailable/);
  assert.equal(ref.data.status, "grant_pending");
  assert.equal(ref.data.processingToken, undefined);
  assert.equal(ref.data.processingUntil, undefined);
  assert.equal(await processor(ref), "active");
  assert.equal(ref.data.status, "active");
});
