import test from "node:test";
import assert from "node:assert/strict";
import { isExpectedSchedulerIdentity } from "./scheduler-auth.js";

test("accepts only the configured verified Cloud Scheduler service account", () => {
  assert.equal(isExpectedSchedulerIdentity({ email: "vip-scheduler@example.iam.gserviceaccount.com", email_verified: true }, "vip-scheduler@example.iam.gserviceaccount.com"), true);
});

test("rejects missing, unverified or different scheduler identities", () => {
  assert.equal(isExpectedSchedulerIdentity(null, "vip-scheduler@example.iam.gserviceaccount.com"), false);
  assert.equal(isExpectedSchedulerIdentity({ email: "vip-scheduler@example.iam.gserviceaccount.com", email_verified: false }, "vip-scheduler@example.iam.gserviceaccount.com"), false);
  assert.equal(isExpectedSchedulerIdentity({ email: "other@example.iam.gserviceaccount.com", email_verified: true }, "vip-scheduler@example.iam.gserviceaccount.com"), false);
  assert.equal(isExpectedSchedulerIdentity({ email: "vip-scheduler@example.iam.gserviceaccount.com", email_verified: true }, ""), false);
});
