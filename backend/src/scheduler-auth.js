export function isExpectedSchedulerIdentity(payload, expectedEmail) {
  return Boolean(
    payload &&
    typeof expectedEmail === "string" &&
    expectedEmail.length > 0 &&
    payload.email === expectedEmail &&
    payload.email_verified === true
  );
}

export function normalizeCloudRunAudience(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("Cloud Run service URL is required for scheduler token audience");
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Cloud Run scheduler audience must be an HTTPS service origin");
  }
  return parsed.origin;
}
