import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("./configure-github-variables.mjs", import.meta.url);

async function withConfig(config, callback) {
  const directory = await mkdtemp(join(tmpdir(), "rustylub-firebase-config-"));
  const file = join(directory, "firebase-config.json");
  try {
    await writeFile(file, JSON.stringify(config));
    return await callback(file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const validConfig = {
  apiKey: "test-public-api-key",
  authDomain: "demo-rustylub-rules.firebaseapp.com",
  projectId: "demo-rustylub-rules",
  storageBucket: "demo-rustylub-rules.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
};

test("Firebase variables helper validates a complete config without printing values", async () => {
  await withConfig(validConfig, async (file) => {
    const result = spawnSync(process.execPath, [script.pathname, file, "https://auth.example.com", "--dry-run"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Validated seven public GitHub Actions Variables/);
    assert.equal(result.stdout.includes(validConfig.apiKey), false);
    assert.equal(result.stdout.includes(validConfig.projectId), false);
  });
});

test("Firebase variables helper rejects incomplete config before invoking GitHub CLI", async () => {
  await withConfig({ apiKey: validConfig.apiKey }, async (file) => {
    const result = spawnSync(process.execPath, [script.pathname, file, "https://auth.example.com", "--dry-run"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Firebase config is incomplete/);
    assert.equal(result.stderr.includes(validConfig.apiKey), false);
  });
});

test("Firebase variables helper rejects insecure or non-origin backend URLs", async () => {
  await withConfig(validConfig, async (file) => {
    for (const url of ["http://auth.example.com", "https://auth.example.com/path", "https://user:pass@auth.example.com"]) {
      const result = spawnSync(process.execPath, [script.pathname, file, url, "--dry-run"], {
        encoding: "utf8",
      });
      assert.equal(result.status, 2, url);
      assert.match(result.stderr, /HTTPS origin/);
    }
  });
});
