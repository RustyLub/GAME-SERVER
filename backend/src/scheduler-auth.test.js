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

import { normalizeCloudRunAudience } from "./scheduler-auth.js";

test("uses the Cloud Run service origin as the OIDC audience", () => {
  assert.equal(
    normalizeCloudRunAudience("https://rusty-lub-auth-123456.europe-west1.run.app"),
    "https://rusty-lub-auth-123456.europe-west1.run.app",
  );
});

test("rejects a path, query, credentials or non-HTTPS scheduler audience", () => {
  for (const value of [
    "https://service.run.app/internal/vip/reconcile",
    "https://service.run.app/?token=secret",
    "https://user:pass@service.run.app",
    "http://service.run.app",
  ]) {
    assert.throws(() => normalizeCloudRunAudience(value));
  }
  assert.throws(() => normalizeCloudRunAudience(""));
});
