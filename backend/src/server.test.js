import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.FRONTEND_ORIGIN = "https://rusty-lub.online";
process.env.BACKEND_PUBLIC_URL = "https://auth.example.com";
process.env.FIREBASE_PROJECT_ID = "rustylub";

const { steamIdFromClaim, buildSteamOpenIdUrl } = await import("./server.js");

test("accepts a canonical SteamID64 claimed_id", () => {
  assert.equal(steamIdFromClaim("https://steamcommunity.com/openid/id/76561198000000000"), "76561198000000000");
});

test("rejects a claimed_id from a different host", () => {
  assert.throws(() => steamIdFromClaim("https://evil.example/openid/id/76561198000000000"));
});

test("rejects malformed and out-of-range Steam IDs", () => {
  assert.throws(() => steamIdFromClaim("https://steamcommunity.com/openid/id/12345"));
  assert.throws(() => steamIdFromClaim("https://steamcommunity.com/openid/id/76561190000000000"));
});

test("creates a Steam OpenID request with a callback-bound state", () => {
  const url = new URL(buildSteamOpenIdUrl("state-test"));
  assert.equal(url.origin + url.pathname, "https://steamcommunity.com/openid/login");
  assert.equal(url.searchParams.get("openid.mode"), "checkid_setup");
  assert.equal(url.searchParams.get("openid.return_to"), "https://auth.example.com/auth/steam/callback?state=state-test");
  assert.equal(url.searchParams.get("openid.realm"), "https://auth.example.com");
});

test("does not accept arbitrary callback origins from request input", () => {
  assert.equal(buildSteamOpenIdUrl("abc").includes("evil.example"), false);
});
