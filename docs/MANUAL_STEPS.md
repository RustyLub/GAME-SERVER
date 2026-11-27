# Rusty.Lub GAME-SERVER — manual release steps

This runbook contains the actions that require access to Firebase, Google Cloud, Discord, Platega, the Rust host and REG.RU. Do not put secret values in GitHub Variables, frontend variables, source files or this document. Use Google Secret Manager and Cloud Run secret mappings.

## 1. Firebase project and Web App

1. In Firebase Console, select or create the dedicated project for GAME-SERVER. Do not silently reuse the legacy Rusty.Lub website project.
2. Create a Firebase Web App in Project settings → General → Your apps.
3. Enable Firebase Authentication. Steam login uses Firebase Custom Tokens minted by the backend; Email/Password is not required.
4. Add `rusty-lub.online` to Authentication → Settings → Authorized domains.
5. Create Cloud Firestore in Production mode.
6. From the repository root, publish the committed rules and indexes:
   ```bash
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
   ```
7. In GitHub → Settings → Secrets and variables → Actions → Variables, set these six public Firebase Web App values:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

Also set `VITE_API_BASE_URL` to `https://auth.rusty-lub.online` after the Cloud Run custom domain is active (section 2). The frontend therefore uses seven public build variables in total: six Firebase values plus the backend origin. These are public browser configuration, not server secrets. Do not put Firebase Admin credentials, Steam/Discord/Platega secrets or RCON passwords in any `VITE_` variable.

Firestore rules allow a user to read only their own profile, update only `customDisplayName` (2–24 characters), and read only their own order documents. The backend alone creates/updates profiles, orders, payment events, entitlements, payment locks, OAuth state and nonce documents.

## 2. Google Cloud and Cloud Run

1. Select the Google Cloud project associated with the dedicated Firebase project. Enable Cloud Run, Cloud Build, Artifact Registry, IAM Credentials, Firebase Authentication, Firestore and Cloud Scheduler APIs. Configure billing.
2. Create two separate service accounts:
   ```bash
   gcloud iam service-accounts create rusty-lub-backend --project YOUR_GCP_PROJECT_ID --display-name "Rusty.Lub Cloud Run backend"
   gcloud iam service-accounts create rusty-lub-vip-scheduler --project YOUR_GCP_PROJECT_ID --display-name "Rusty.Lub VIP expiry scheduler"
   ```
   Use the backend service account for Cloud Run. Set `VIP_SCHEDULER_SERVICE_ACCOUNT` to the scheduler account email.
3. Grant the Cloud Run runtime service account:
   - `roles/firebaseauth.admin`
   - `roles/datastore.user`
   Grant the identity running `gcloud run deploy --source` `roles/iam.serviceAccountUser` on the runtime service account. In IAM, verify the Cloud Build service account used by the project has `roles/run.builder` and Artifact Registry write access.
4. Allow the Cloud Run runtime service account to mint Firebase custom tokens by granting `roles/iam.serviceAccountTokenCreator` on that same runtime service account to itself.
5. Configure Secret Manager secrets:
   - `DISCORD_CLIENT_SECRET`
   - `RCON_PASSWORD`
   - `PLATEGA_SECRET` (only after Platega approves the merchant)
   - `STEAM_API_KEY` (optional; only for public nickname/avatar enrichment)
   Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on each secret it uses. Do not grant broad project-wide secret access if per-secret access is practical.
6. Run the deployment script from a trusted terminal with gcloud installed. Use the exact service account/project values you created:
   ```bash
   export GCP_PROJECT_ID=YOUR_GCP_PROJECT_ID
   export FIREBASE_PROJECT_ID=YOUR_DEDICATED_FIREBASE_PROJECT_ID
   export RUNTIME_SERVICE_ACCOUNT=rustylub-backend@YOUR_PROJECT.iam.gserviceaccount.com
   export VIP_SCHEDULER_SERVICE_ACCOUNT=rusty-lub-vip-scheduler@YOUR_PROJECT.iam.gserviceaccount.com
   export DISCORD_CLIENT_ID=YOUR_DISCORD_APPLICATION_ID
   export DISCORD_CLIENT_SECRET_SECRET_NAME=YOUR_DISCORD_SECRET_NAME
   export RCON_HOST=YOUR_TLS_WEBSOCKET_HOST
   export RCON_PORT=443
   export RCON_PROTOCOL=wss
   export RCON_PASSWORD_SECRET_NAME=YOUR_RCON_SECRET_NAME
   export STEAM_API_KEY_SECRET_NAME=YOUR_STEAM_API_SECRET_NAME
   # Optional: if Cloud Run uses a Serverless VPC Access connector and Cloud NAT:
   export VPC_CONNECTOR=YOUR_SERVERLESS_VPC_CONNECTOR
   export VPC_EGRESS=all-traffic
   bash backend/deploy-cloud-run.sh
   ```
   The first run creates the Cloud Run service and prints its `run.app` URL. Do not set `LEGAL_DETAILS_COMPLETE=true` yet.
7. Create a Cloud Run custom domain mapping for `auth.rusty-lub.online`:
   ```bash
   gcloud run domain-mappings create --service rusty-lub-auth --domain auth.rusty-lub.online --region YOUR_REGION --project YOUR_GCP_PROJECT_ID
   gcloud run domain-mappings describe --domain auth.rusty-lub.online --region YOUR_REGION --project YOUR_GCP_PROJECT_ID
   ```
   Add the exact DNS records returned by Google at REG.RU and wait for the custom-domain certificate. Then set `BACKEND_PUBLIC_URL=https://auth.rusty-lub.online` and run the deployment script a second time. This makes Steam/Discord state cookies same-site with the website. Set the same public URL as GitHub Actions Variable `VITE_API_BASE_URL`.
8. Add the six Firebase Web App variables from section 1 to GitHub Actions Variables.
9. Configure Firestore TTL on `expiresAt` for `steamAuthExchanges`, `steamOpenIdNonces`, `discordAuthStates` and `paymentLocks`. Application code independently checks expiry.
10. Open `https://auth.rusty-lub.online/health`; expect `{"ok":true}`.

The Cloud Run service must allow unauthenticated invocation because Steam and Discord redirect callbacks arrive without a Firebase bearer token. Protected JSON endpoints still verify Firebase ID tokens, exact browser Origin, OAuth state and one-time codes. Server secrets stay in Secret Manager / Cloud Run.

## 3. Steam authentication

1. From `https://rusty-lub.online/account`, test first-time Steam sign-in. It should create Firebase UID `steam_<SteamID64>` and `users/{uid}`.
2. Sign out and sign in again. It must resolve to the same Firebase account.
3. Verify logout, invalid OpenID response rejection, replayed nonce rejection and one-time exchange-code rejection.
4. If a Steam Web API key is configured, verify it exists only in Secret Manager and is mapped to server variable `STEAM_API_KEY`.

## 4. Discord account linking

1. Create/open the Discord application in the Developer Portal.
2. Add the exact OAuth2 redirect URL: `https://auth.rusty-lub.online/auth/discord/callback`.
3. Set the application ID as `DISCORD_CLIENT_ID` on Cloud Run. Store the client secret in Secret Manager and map it to `DISCORD_CLIENT_SECRET`.
4. The implementation requests only the `identify` scope. It does not request guild membership, email or bot permissions and does not persist the OAuth access token.
5. Test link, relink, unlink and rejection when the Discord account is already linked to another Rusty.Lub profile.

## 5. Live status and secure Vanilla RCON

1. Enable WebRCON in the Rust server panel and confirm the correct host, port and password. Do not change gameplay settings or install Carbon/Oxide.
2. Do not expose plain `ws://` WebRCON over the public internet. Production backend deliberately rejects plaintext RCON. Use a hosting-provider secure WebSocket endpoint (`wss://`) or a TLS reverse proxy forwarding WebSocket upgrades to the private WebRCON port.
3. If you manage the host yourself, place Nginx/another TLS proxy in front of the local WebRCON listener, install a valid certificate for a dedicated hostname, preserve the request path, and allow inbound access only from the Cloud Run egress IP. Example Nginx location:
   ```nginx
   location / {
     proxy_pass http://127.0.0.1:26229;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "Upgrade";
     proxy_set_header Host $host;
     proxy_read_timeout 60s;
     access_log off;
   }
   ```
4. Set `RCON_PROTOCOL=wss`, `RCON_HOST` to the TLS proxy hostname, `RCON_PORT` to its TLS port (usually 443), and store `RCON_PASSWORD` only in Secret Manager. Do not publish the RCON password in the browser or repository. WebRCON carries the password in the WebSocket URL path, so disable access logging on the TLS proxy or explicitly redact the path.
5. Optionally configure a Cloud Run Serverless VPC Access connector and Cloud NAT with a reserved static egress IP, then allowlist that IP at the TLS proxy. The deployment script accepts `VPC_CONNECTOR` and `VPC_EGRESS=all-traffic`.
6. Test `/public/server-status`. Without secure RCON it intentionally displays “status unavailable”; VIP checkout remains disabled.

## 6. Platega and VIP Queue Pass activation

Payment code is already merged into `main` after a green build and payment test suite. Checkout remains disabled until all steps below are completed.

1. Obtain Merchant ID and API secret from Platega. Store the secret in Secret Manager as `PLATEGA_SECRET`; set `PLATEGA_MERCHANT_ID` and `PLATEGA_API_BASE=https://api.eu.payplatform.cc` as Cloud Run environment variables.
2. Confirm payment method `2` (SBP QR) is enabled for the merchant. The request sends the permanent SteamID64 as `metadata.userId` and `SteamID64@mail.ru` as `metadata.user_email`, following Platega guidance for a stable pseudonymous buyer ID when no email is collected. It is not represented as the customer's real mailbox. Confirm this format and payment method with the Platega manager for your merchant category.
3. Export the non-secret payment settings in the same terminal session used for deployment:
   ```bash
   export PLATEGA_API_BASE=https://api.eu.payplatform.cc
   export PLATEGA_MERCHANT_ID=YOUR_MERCHANT_ID
   export PLATEGA_PAYMENT_METHOD=2
   export VIP_PRICE_RUB=YOUR_PRICE_IN_RUBLES
   export PLATEGA_SECRET_SECRET_NAME=YOUR_PLATEGA_SECRET_NAME
   ```
   Then run `bash backend/deploy-cloud-run.sh` to apply them. Never put the Platega secret value in the terminal command, GitHub Variables or repository.
4. Set the merchant callback URL to `https://auth.rusty-lub.online/payments/platega/callback`.
5. Platega documents callback authentication with `X-MerchantId` and `X-Secret` headers, not an HMAC signature. The handler checks both values in constant time, then calls `GET /transaction/{id}` and verifies current status, merchant, amount, currency and order payload before granting anything. Duplicate status notifications and refund events are idempotent. For `CONFIRMED`, the backend first writes a durable `grant_pending` entitlement; if RCON is unavailable it returns 500 and provider / Cloud Scheduler retries can complete the action.
6. Use the dedicated scheduler service account created in section 2. Grant it `roles/run.invoker` on the Cloud Run service:
   ```bash
   gcloud run services add-iam-policy-binding rusty-lub-auth --project YOUR_GCP_PROJECT_ID --region YOUR_REGION --member="serviceAccount:rusty-lub-vip-scheduler@YOUR_PROJECT.iam.gserviceaccount.com" --role="roles/run.invoker"
   PROJECT_NUMBER=$(gcloud projects describe YOUR_GCP_PROJECT_ID --format="value(projectNumber)")
   gcloud iam service-accounts add-iam-policy-binding rusty-lub-vip-scheduler@YOUR_PROJECT.iam.gserviceaccount.com --project YOUR_GCP_PROJECT_ID --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"
   ```
   Ensure the Cloud Scheduler service agent exists and has its standard `roles/cloudscheduler.serviceAgent` project role. Create a Scheduler job with OIDC authentication (no shared secret):
   ```bash
   gcloud scheduler jobs create http rusty-lub-vip-reconcile \
     --location YOUR_REGION \
     --schedule "*/5 * * * *" \
     --time-zone "Etc/UTC" \
     --uri "https://auth.rusty-lub.online/internal/vip/reconcile" \
     --http-method POST \
     --oidc-service-account-email "rusty-lub-vip-scheduler@YOUR_PROJECT.iam.gserviceaccount.com" \
     --oidc-token-audience "$CLOUD_RUN_SERVICE_URL"
   ```
   Confirm the Cloud Scheduler service agent can mint OIDC tokens for that service account. The backend verifies the Google-signed token and exact service-account email.
7. Publish the final seller/operator identity, legal address/contact details required by applicable law, tax status, payment recipient details, approved price and reviewed refund/cancellation terms on the legal pages. Have the actual operator jurisdiction and Platega merchant agreement reviewed. Only after this review, export `LEGAL_DETAILS_COMPLETE=true` in the trusted deployment terminal and run `bash backend/deploy-cloud-run.sh` again. Do not set this flag earlier. This server-side gate keeps checkout disabled until those details are complete.
8. Test the native Rust commands on a non-production/test SteamID64 first:
   ```text
   global.skipqueueid <SteamID64> "<nickname>" "Rusty.Lub VIP Queue Pass"
   server.writecfg
   global.removeskipqueue <SteamID64>
   server.writecfg
   ```
   Keep the production `server.maxplayers` value unchanged (200); the Facepunch hidden-whitelist example that sets it to 0 is not part of this VIP setup. Check that the SteamID64 does not already have a manually assigned queue-skip permission; Rust stores this as a single permission and automatic expiry could remove an independently granted right. Test issue, reconnect, seven-day expiry and removal before sales. Facepunch references: https://wiki.facepunch.com/rust/Creating_a_hidden_whitelisted_server and https://commits.facepunch.com/Rohan/rust_reboot/main/general_qol/skipqueue.
9. Run the payment tests in CI. Use a provider test payment or a low-value approved live test only after the merchant has confirmed the callback configuration.
10. For a refund request, verify the order and entitlement in Firestore, process the refund in the Platega merchant dashboard, then verify the provider callback changes the order status and revokes the native queue permission on full refund or chargeback. Partial refunds do not automatically revoke a pass unless the provider reports the full amount refunded.

The game server stays strictly Vanilla. VIP uses only native Rust queue permissions through secure RCON; no Carbon, Oxide/uMod or other game plugin is installed. The pass lasts seven days after server-side issuance and does not guarantee an available slot.

## 7. Domain and HTTPS

The repository uses a custom GitHub Actions Pages workflow. The `public/CNAME` file alone does not set the Pages custom domain.

1. Open GitHub → RustyLub/GAME-SERVER → Settings → Pages.
2. Under Custom domain, set `rusty-lub.online` and save.
3. At REG.RU, set the apex A records to GitHub Pages:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
4. Remove conflicting old apex A records, including the previous hosting address `31.31.197.49` if it is still present. Do not change MX, SPF, DKIM, DMARC or `long.rusty-lub.online`, which points to the game server.
5. If you want `www.rusty-lub.online`, add a CNAME for host `www` pointing directly to `RustyLub.github.io`.
6. Wait for DNS propagation and GitHub Pages certificate issuance. Then enable Enforce HTTPS in Settings → Pages. GitHub Pages performs HTTP → HTTPS redirection after this is enabled.
7. Verify with `Resolve-DnsName rusty-lub.online`, `curl -I http://rusty-lub.online` and `curl -I https://rusty-lub.online`. Confirm the certificate name, validity and redirect destination.

## 8. Legal and commercial publication

1. Complete seller/operator identity, tax status, payment recipient and contact details before opening checkout. These are intentionally not invented in repository text.
2. Have the Privacy Policy, Terms, cancellation and refund clauses reviewed for the actual operator jurisdiction and Platega merchant agreement.
3. The project is explicitly unofficial and not affiliated with Facepunch Studios.
4. No analytics or advertising cookies are currently installed. If analytics or other non-essential cookies are introduced, add a consent manager before enabling them and update the Privacy Policy.
5. Verify the product description: one-time seven-day queue-skip entitlement only; no game items, boosted rates or guarantee of a free server slot.

## 9. SEO and social preview

1. After the domain and HTTPS are active, open the homepage source and confirm canonical, title, description, Open Graph and Twitter metadata.
2. Test the public RU and EN OG image URLs:
   - `https://rusty-lub.online/og-ru.png`
   - `https://rusty-lub.online/og-en.png`
3. Submit the homepage to the Facebook Sharing Debugger and LinkedIn Post Inspector to refresh cached previews. The public OG assets are 1200×630 PNGs for broad crawler compatibility; optimized WebP counterparts are generated as well.
4. Submit `https://rusty-lub.online/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## 10. Final acceptance

- [ ] RU/EN routes and language switch work, including the 404 fallback.
- [ ] Check 360px and 390px phone widths, open/close the mobile navigation, and confirm there is no horizontal page overflow.
- [ ] Home shows the configured server address, copy action, Steam connect link, next wipe and server status.
- [ ] Steam sign-in, repeat sign-in and logout pass against the real Firebase project.
- [ ] Discord link/unlink and unique-account enforcement pass.
- [ ] Firestore owner-only profile and order reads are verified against deployed rules.
- [ ] Platega test payment, callback, duplicate callback, refund/chargeback and seven-day VIP issuance/revocation pass.
- [ ] Secure WSS RCON status and VIP issuance work without installing any game plugin.
- [ ] DNS, TLS certificate, HTTPS redirect and social previews are verified.
- [ ] Legal operator details are completed and reviewed.
