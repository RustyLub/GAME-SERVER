export function isExpectedSchedulerIdentity(payload, expectedEmail) {
  return Boolean(
    payload &&
    typeof expectedEmail === "string" &&
    expectedEmail.length > 0 &&
    payload.email === expectedEmail &&
    payload.email_verified === true
  );
}
