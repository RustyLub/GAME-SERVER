import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.FRONTEND_ORIGIN = "https://rusty-lub.online";
process.env.BACKEND_PUBLIC_URL = "https://auth.example.com";
process.env.FIREBASE_PROJECT_ID = "rustylub-test";

const { parseCookies, sha256, steamIdFromClaim, buildSteamOpenIdUrl, verifySteamAssertion, buildDiscordAuthorizeUrl, parseRustServerInfo } =
  await import("./server.js");

test("accepts a canonical SteamID64 claimed_id", () => {
  assert.equal(
    steamIdFromClaim("https://steamcommunity.com/openid/id/76561198000000000"),
    "76561198000000000",
  );
});

test("rejects a claimed_id from a different host", () => {
  assert.throws(() => steamIdFromClaim("https://evil.example/openid/id/76561198000000000"));
});

test("rejects malformed and out-of-range Steam IDs", () => {
  assert.throws(() => steamIdFromClaim("https://steamcommunity.com/openid/id/12345"));
  assert.throws(() => steamIdFromClaim("https://steamcommunity.com/openid/id/76561190000000000"));
});

test("builds a Steam OpenID request with an exact callback-bound state", () => {
  const url = new URL(buildSteamOpenIdUrl("state-test"));
  assert.equal(url.origin + url.pathname, "https://steamcommunity.com/openid/login");
  assert.equal(url.searchParams.get("openid.mode"), "checkid_setup");
  assert.equal(
    url.searchParams.get("openid.return_to"),
    "https://auth.example.com/auth/steam/callback?state=state-test",
  );
  assert.equal(url.searchParams.get("openid.realm"), "https://auth.example.com");
});

test("does not accept arbitrary callback origins from request input", () => {
  assert.equal(buildSteamOpenIdUrl("abc").includes("evil.example"), false);
});

test("parses valid cookies and safely ignores malformed percent escapes", () => {
  assert.deepEqual(parseCookies("a=hello%20world; bad=%E0%A4%A; rustylub_steam_state=abc"), {
    a: "hello world",
    rustylub_steam_state: "abc",
  });
});

test("hashes one-time exchange codes deterministically", () => {
  assert.equal(sha256("sample-code"), sha256("sample-code"));
  assert.notEqual(sha256("sample-code"), "sample-code");
});

test("rejects an OpenID response with a mismatched state before network verification", async () => {
  const params = new URLSearchParams({
    state: "wrong-state",
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
  });
  await assert.rejects(verifySteamAssertion(params, "expected-state"), /State mismatch/);
});


test("builds Discord OAuth URL with the exact callback and identify-only scope", () => {
  const url = new URL(buildDiscordAuthorizeUrl("discord-state"));
  assert.equal(url.origin + url.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://auth.example.com/auth/discord/callback");
  assert.equal(url.searchParams.get("scope"), "identify");
  assert.equal(url.searchParams.get("state"), "discord-state");
});

test("parses the Rust serverinfo player counts from RCON", () => {
  assert.deepEqual(parseRustServerInfo('{"Players":17,"MaxPlayers":200}'), {
    online: true,
    players: 17,
    maxPlayers: 200,
  });
});

test("rejects malformed or incomplete Rust serverinfo responses", () => {
  assert.throws(() => parseRustServerInfo("not-json"), /not JSON/);
  assert.throws(() => parseRustServerInfo('{"Players":1}'), /player counts/);
});
