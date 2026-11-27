export function createCachedServerStatusReader(readStatus, { ttlMs = 10_000, now = Date.now } = {}) {
  if (typeof readStatus !== "function") throw new TypeError("readStatus must be a function");
  if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new RangeError("ttlMs must be a non-negative number");

  let cached = null;
  let inFlight = null;

  return async function readCachedStatus() {
    const currentTime = now();
    if (cached && currentTime < cached.expiresAt) return { ...cached.value };
    if (inFlight) return { ...(await inFlight) };

    inFlight = Promise.resolve()
      .then(readStatus)
      .then((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new TypeError("Server status reader must return an object");
        }
        cached = { value: { ...value }, expiresAt: now() + ttlMs };
        return cached.value;
      })
      .finally(() => {
        inFlight = null;
      });

    return { ...(await inFlight) };
  };
}
