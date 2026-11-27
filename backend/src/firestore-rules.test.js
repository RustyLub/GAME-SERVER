import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

test("profile reads are restricted to the authenticated owner", () => {
  assert.match(rules, /allow get: if ownsProfile\(userId\)/);
  assert.match(rules, /request\.auth\.uid == userId/);
});

test("profile updates are restricted to the custom display name field", () => {
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['customDisplayName'\]\)/);
  assert.match(rules, /customDisplayName\.size\(\) >= 2/);
  assert.match(rules, /customDisplayName\.size\(\) <= 24/);
  assert.match(rules, /allow list, create, delete: if false/);
});

test("orders are read-only and scoped to the authenticated owner", () => {
  assert.match(rules, /allow get, list: if request\.auth != null && resource\.data\.userId == request\.auth\.uid/);
  assert.match(rules, /allow create, update, delete: if false/);
});

test("all internal collections remain denied by default", () => {
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
