import test from "node:test";
import assert from "node:assert/strict";
import { createCachedServerStatusReader } from "./server-status.js";

test("caches successful server status reads for the configured TTL", async () => {
  let time = 100;
  let calls = 0;
  const read = createCachedServerStatusReader(async () => {
    calls += 1;
    return { online: true, players: calls, maxPlayers: 200 };
  }, { ttlMs: 1000, now: () => time });

  assert.deepEqual(await read(), { online: true, players: 1, maxPlayers: 200 });
  assert.deepEqual(await read(), { online: true, players: 1, maxPlayers: 200 });
  assert.equal(calls, 1);

  time = 1100;
  assert.deepEqual(await read(), { online: true, players: 2, maxPlayers: 200 });
  assert.equal(calls, 2);
});

test("coalesces concurrent status requests into one RCON read", async () => {
  let calls = 0;
  let release;
  const read = createCachedServerStatusReader(() => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  });

  const first = read();
  const second = read();
  await Promise.resolve();
  assert.equal(calls, 1);
  release({ online: true, players: 5, maxPlayers: 200 });
  assert.deepEqual(await Promise.all([first, second]), [
    { online: true, players: 5, maxPlayers: 200 },
    { online: true, players: 5, maxPlayers: 200 },
  ]);
});

test("does not cache failures and retries the next request", async () => {
  let calls = 0;
  const read = createCachedServerStatusReader(async () => {
    calls += 1;
    if (calls === 1) throw new Error("RCON unavailable");
    return { online: true, players: 0, maxPlayers: 200 };
  });

  await assert.rejects(read(), /RCON unavailable/);
  assert.deepEqual(await read(), { online: true, players: 0, maxPlayers: 200 });
  assert.equal(calls, 2);
});

test("returns copies so callers cannot mutate the cached value", async () => {
  const read = createCachedServerStatusReader(async () => ({ online: true, players: 3, maxPlayers: 200 }));
  const first = await read();
  first.players = 999;
  assert.deepEqual(await read(), { online: true, players: 3, maxPlayers: 200 });
});
