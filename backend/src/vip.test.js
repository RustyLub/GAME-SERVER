import test from "node:test";
import assert from "node:assert/strict";
import {
  VIP_DURATION_DAYS,
  VIP_DURATION_MS,
  parseVipPrice,
  constantTimeSecretMatch,
  nextVipExpiry,
  isValidSteamId64,
  buildPlategaPaymentBody,
} from "./vip.js";

test("VIP entitlement duration is exactly seven days", () => {
  assert.equal(VIP_DURATION_DAYS, 7);
  assert.equal(VIP_DURATION_MS, 7 * 24 * 60 * 60 * 1000);
});

test("VIP price accepts only positive whole RUB amounts", () => {
  assert.equal(parseVipPrice("300"), 300);
  assert.equal(parseVipPrice(undefined), null);
  assert.throws(() => parseVipPrice("0"));
  assert.throws(() => parseVipPrice("12.5"));
  assert.throws(() => parseVipPrice("not-a-price"));
});

test("Platega callback secrets are compared safely and exactly", () => {
  assert.equal(constantTimeSecretMatch("secret-value", "secret-value"), true);
  assert.equal(constantTimeSecretMatch("secret-value", "secret-valuE"), false);
  assert.equal(constantTimeSecretMatch("", "secret-value"), false);
  assert.equal(constantTimeSecretMatch(undefined, "secret-value"), false);
});

test("VIP renewal extends from the later of now or current expiry", () => {
  const now = 1_800_000_000_000;
  assert.equal(nextVipExpiry(now, now - 1), now + VIP_DURATION_MS);
  assert.equal(nextVipExpiry(now, now + 2 * VIP_DURATION_MS), now + 3 * VIP_DURATION_MS);
});

test("only canonical SteamID64 values are accepted", () => {
  assert.equal(isValidSteamId64("76561198000000000"), true);
  assert.equal(isValidSteamId64("12345"), false);
  assert.equal(isValidSteamId64("76561190000000000"), false);
});

test("Platega payment metadata is tied to the authenticated Steam identity", () => {
  const body = buildPlategaPaymentBody({
    price: 300,
    steamId64: "76561198000000000",
    uid: "steam_76561198000000000",
    displayName: "Rusty Player",
    orderId: "order-123",
    successUrl: "https://rusty-lub.online/?vip=return",
    failedUrl: "https://rusty-lub.online/?vip=failed",
  });
  assert.equal(body.paymentDetails.amount, 300);
  assert.equal(body.paymentDetails.currency, "RUB");
  assert.equal(body.payload, "order-123");
  assert.equal(body.metadata.userId, "steam_76561198000000000");
  assert.equal(body.metadata.user_email, "76561198000000000@mail.ru");
  assert.throws(() => buildPlategaPaymentBody({
    price: 300, steamId64: "76561198000000000", uid: "someone-else",
    orderId: "order-123", successUrl: "https://example.com", failedUrl: "https://example.com",
  }));
});
