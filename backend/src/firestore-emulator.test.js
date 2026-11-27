import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";

const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
const projectId = "demo-rustylub-rules";
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules },
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test.after(async () => {
  await testEnv.cleanup();
});

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

test("only the profile owner can read their profile", async () => {
  const uid = "steam_76561198000000001";
  await seed("users/" + uid, { steamId64: "76561198000000001", displayName: "Player" });

  const ownerDb = testEnv.authenticatedContext(uid).firestore();
  const otherDb = testEnv.authenticatedContext("steam_76561198000000002").firestore();

  await assertSucceeds(getDoc(doc(ownerDb, "users", uid)));
  await assertFails(getDoc(doc(otherDb, "users", uid)));
  await assertFails(getDocs(collection(ownerDb, "users")));
});

test("profile owner may update only a valid customDisplayName", async () => {
  const uid = "steam_76561198000000003";
  await seed("users/" + uid, { steamId64: "76561198000000003", displayName: "Player", customDisplayName: "Old" });

  const db = testEnv.authenticatedContext(uid).firestore();
  const profile = doc(db, "users", uid);

  await assertSucceeds(updateDoc(profile, { customDisplayName: "New name" }));
  await assertFails(updateDoc(profile, { displayName: "Changed by client" }));
  await assertFails(updateDoc(profile, { customDisplayName: "x" }));
  await assertFails(updateDoc(profile, { customDisplayName: "This display name is much too long" }));
  await assertFails(deleteDoc(profile));
});

test("orders are owner-readable only and cannot be written by clients", async () => {
  const ownerUid = "steam_76561198000000004";
  const otherUid = "steam_76561198000000005";
  await seed("orders/order-owner", { userId: ownerUid, amount: 100, status: "paid" });
  await seed("orders/order-other", { userId: otherUid, amount: 200, status: "paid" });

  const ownerDb = testEnv.authenticatedContext(ownerUid).firestore();
  const otherDb = testEnv.authenticatedContext(otherUid).firestore();

  await assertSucceeds(getDoc(doc(ownerDb, "orders", "order-owner")));
  await assertFails(getDoc(doc(ownerDb, "orders", "order-other")));
  await assertSucceeds(getDocs(query(collection(ownerDb, "orders"), where("userId", "==", ownerUid))));
  await assertFails(getDocs(collection(ownerDb, "orders")));
  await assertFails(setDoc(doc(ownerDb, "orders", "forged-order"), { userId: ownerUid, amount: 1 }));
  await assertFails(updateDoc(doc(ownerDb, "orders", "order-owner"), { amount: 1 }));
  await assertFails(deleteDoc(doc(ownerDb, "orders", "order-owner")));
});

test("payment, entitlement and OAuth internals are denied to browser clients", async () => {
  const uid = "steam_76561198000000006";
  await seed("entitlements/vip-order", { userId: uid, status: "active" });
  await seed("paymentEvents/event-1", { userId: uid, status: "CONFIRMED" });
  await seed("paymentLocks/" + uid, { orderId: "vip-order" });
  await seed("steamAuthExchanges/hash-1", { uid });
  await seed("discordAuthStates/hash-2", { uid });

  const db = testEnv.authenticatedContext(uid).firestore();
  await assertFails(getDoc(doc(db, "entitlements", "vip-order")));
  await assertFails(getDoc(doc(db, "paymentEvents", "event-1")));
  await assertFails(getDoc(doc(db, "paymentLocks", uid)));
  await assertFails(getDoc(doc(db, "steamAuthExchanges", "hash-1")));
  await assertFails(getDoc(doc(db, "discordAuthStates", "hash-2")));
});
