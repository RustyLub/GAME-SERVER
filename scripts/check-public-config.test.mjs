import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-public-config.mjs", import.meta.url));
const baseEnv = {
  ...process.env,
  VITE_FIREBASE_API_KEY: "",
  VITE_FIREBASE_AUTH_DOMAIN: "",
  VITE_FIREBASE_PROJECT_ID: "",
  VITE_FIREBASE_STORAGE_BUCKET: "",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "",
  VITE_FIREBASE_APP_ID: "",
  VITE_API_BASE_URL: "",
};

function run(env) {
  return spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...baseEnv, ...env } });
}

test("uses the existing Firebase defaults while keeping the API disabled until its proxy is live", () => {
  const result = run({});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Firebase configuration is valid/);
  assert.match(result.stdout, /Backend API remains disabled/);
});

test("accepts a valid HTTPS backend origin", () => {
  const result = run({ VITE_API_BASE_URL: "https://auth.rusty-lub.online" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backend origin are structurally valid/);
});

test("rejects an insecure or path-qualified backend URL", () => {
  const insecure = run({ VITE_API_BASE_URL: "http://auth.rusty-lub.online" });
  assert.notEqual(insecure.status, 0);
  const path = run({ VITE_API_BASE_URL: "https://auth.rusty-lub.online/api" });
  assert.notEqual(path.status, 0);
});

test("rejects an invalid Firebase project ID override", () => {
  const result = run({ VITE_FIREBASE_PROJECT_ID: "invalid project id" });
  assert.notEqual(result.status, 0);
});
