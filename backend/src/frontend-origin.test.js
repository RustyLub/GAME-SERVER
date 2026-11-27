import test from "node:test";
import assert from "node:assert/strict";
import { parseFrontendOrigins, resolveFrontendOrigin } from "./frontend-origin.js";

test("parses and deduplicates the primary and secondary HTTPS frontend origins", () => {
  const allowed = parseFrontendOrigins(
    "https://rusty-lub.online",
    "https://rusty-lub.online;https://rusty-lub.ru",
  );
  assert.deepEqual(allowed, ["https://rusty-lub.online", "https://rusty-lub.ru"]);
});

test("rejects insecure or non-origin frontend URLs", () => {
  for (const value of [
    "http://rusty-lub.ru",
    "https://rusty-lub.ru/account",
    "https://user:pass@rusty-lub.ru",
    "https://rusty-lub.ru?next=example",
  ]) {
    assert.throws(() => parseFrontendOrigins("https://rusty-lub.online", value));
  }
});

test("only resolves exact allowlisted browser origins", () => {
  const allowed = parseFrontendOrigins("https://rusty-lub.online", "https://rusty-lub.ru");
  assert.equal(resolveFrontendOrigin("https://rusty-lub.ru", allowed), "https://rusty-lub.ru");
  assert.equal(resolveFrontendOrigin("https://evil.example", allowed), null);
  assert.equal(resolveFrontendOrigin(undefined, allowed), null);
});
