#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const [configPath, backendOrigin, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
const repository = "RustyLub/GAME-SERVER";

if (!configPath || !backendOrigin || flags.some((flag) => flag !== "--dry-run")) {
  console.error("Usage: node scripts/configure-github-variables.mjs <firebase-config.json> <https-backend-origin> [--dry-run]");
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(await readFile(configPath, "utf8"));
} catch {
  console.error("Could not read Firebase config JSON. Export the Web App firebaseConfig object as JSON.");
  process.exit(2);
}

const config = parsed.firebaseConfig && typeof parsed.firebaseConfig === "object"
  ? parsed.firebaseConfig
  : parsed;

const mapping = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
  VITE_FIREBASE_APP_ID: config.appId,
  VITE_API_BASE_URL: backendOrigin,
};

const missing = Object.entries(mapping)
  .filter(([, value]) => typeof value !== "string" || !value.trim())
  .map(([name]) => name);
if (missing.length) {
  console.error("Firebase config is incomplete. Missing fields for: " + missing.join(", "));
  process.exit(2);
}

if (!/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(mapping.VITE_FIREBASE_PROJECT_ID)) {
  console.error("Firebase projectId is invalid.");
  process.exit(2);
}
if (!/^\d+$/.test(mapping.VITE_FIREBASE_MESSAGING_SENDER_ID)) {
  console.error("Firebase messagingSenderId must contain only digits.");
  process.exit(2);
}
if (/[\\s/]/.test(mapping.VITE_FIREBASE_AUTH_DOMAIN)) {
  console.error("Firebase authDomain must be a hostname.");
  process.exit(2);
}

let backend;
try {
  backend = new URL(backendOrigin);
} catch {
  console.error("Backend origin is not a valid URL.");
  process.exit(2);
}
if (backend.protocol !== "https:" || backend.username || backend.password ||
    backend.pathname !== "/" || backend.search || backend.hash) {
  console.error("Backend URL must be an HTTPS origin without a path, query, credentials or fragment.");
  process.exit(2);
}

if (dryRun) {
  console.log("Validated seven public GitHub Actions Variables. No values were printed or changed.");
  process.exit(0);
}

try {
  execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
} catch {
  console.error("GitHub CLI is not authenticated. Run: gh auth login");
  process.exit(2);
}

for (const [name, value] of Object.entries(mapping)) {
  execFileSync("gh", ["variable", "set", name, "--body", value, "--repo", repository], {
    stdio: "ignore",
  });
  console.log("Set GitHub Actions Variable: " + name);
}
console.log("All seven public configuration variables are set. No secret values were used.");
