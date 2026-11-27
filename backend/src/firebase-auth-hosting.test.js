import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const configUrl = new URL("../../firebase.auth.json", import.meta.url);
const config = JSON.parse(await readFile(configUrl, "utf8"));
const hosting = config.hosting;
const deployScript = await readFile(new URL("../deploy-cloud-run.sh", import.meta.url), "utf8");
const hostingDeployScript = await readFile(new URL("../deploy-auth-hosting.sh", import.meta.url), "utf8");

test("auth hostname is a dedicated Firebase Hosting site that proxies every dynamic route to Cloud Run", async () => {
  assert.equal(hosting.site, "rustylub-auth");
  assert.equal(hosting.public, "backend/hosting-auth");
  assert.deepEqual(hosting.rewrites, [{
    source: "**",
    run: { serviceId: "rusty-lub-auth", region: "europe-west1" },
  }]);
  assert.match(deployScript, /\[\[ -n "\$SERVICE_NAME" \]\] \|\| SERVICE_NAME="rusty-lub-auth"/);
  assert.match(deployScript, /\[\[ -n "\$REGION" \]\] \|\| REGION="europe-west1"/);
  assert.match(deployScript, /\[\[ "\$REGION" == "europe-west1" \]\]/);
  assert.match(deployScript, /\[\[ "\$FIREBASE_PROJECT_ID" == "\$GCP_PROJECT_ID" \]\]/);
  assert.match(deployScript, /\[\[ "\$SERVICE_NAME" == "rusty-lub-auth" \]\]/);
  assert.match(hostingDeployScript, /firebase-tools@15\.37\.0 deploy --config firebase\.auth\.json --only hosting/);
  assert.match(hostingDeployScript, /\[\[ "\$REGION" == "europe-west1" \]\]/);
  assert.match(hostingDeployScript, /\[\[ "\$FIREBASE_PROJECT_ID" == "\$GCP_PROJECT_ID" \]\]/);
  assert.match(hostingDeployScript, /\[\[ "\$SERVICE_NAME" == "rusty-lub-auth" \]\]/);
  await access(new URL("../hosting-auth/404.html", import.meta.url), constants.R_OK);
  await assert.rejects(access(new URL("../hosting-auth/index.html", import.meta.url), constants.F_OK));
});

test("auth Hosting config contains no redirect that would change the auth hostname", () => {
  assert.equal(hosting.redirects, undefined);
});
