# Rusty.Lub GAME-SERVER — manual release steps

This file lists console actions that cannot be completed from the repository alone. Do not put any secret in frontend variables, source code, Git history or this file. Replace placeholders only in your own terminal or cloud console.

## 1. Firebase project and Web App

1. Open Firebase Console and select/create the dedicated project used only by GAME-SERVER. Do not reuse the legacy Rusty.Lub website Firebase project unless you explicitly confirm that it is the intended project.
2. Create a Firebase Web App in Project settings → General → Your apps.
3. Enable Authentication. Steam login uses Firebase Custom Tokens minted by the backend; no Email/Password provider is needed.
4. Add `rusty-lub.online` to Authentication → Settings → Authorized domains.
5. Create Cloud Firestore in Production mode.
6. Publish rules and indexes from the repository root:
   ```bash
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
   ```
7. In the GitHub repository Settings → Secrets and variables → Actions → Variables, set the six public Web App variables from Firebase:
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET
   - VITE_FIREBASE_MESSAGING_SENDER_ID
   - VITE_FIREBASE_APP_ID
8. Also set VITE_API_BASE_URL after the Cloud Run deployment below. These VITE_ values are public browser configuration, not secrets.

Firestore rules allow each user to read their own profile, update only customDisplayName, and read only their own order documents. The backend alone creates/updates profiles, orders, payment events, entitlements, OAuth state and nonce documents.

## 2. Google Cloud / Cloud Run

1. Select the Google Cloud project that owns the dedicated Firebase project. Enable Cloud Run, Cloud Build, Artifact Registry, IAM Credentials, Firebase Authentication and Firestore APIs. Configure billing.
2. Create a dedicated runtime service account, for example `rustylub-backend@YOUR_PROJECT.iam.gserviceaccount.com`.
3. Grant project-level roles:
   - Firebase Authentication Admin: `roles/firebaseauth.admin`
   - Firestore data access: `roles/datastore.user`
4. Allow the runtime service account to mint Firebase custom tokens by granting `roles/iam.serviceAccountTokenCreator` on that same service account to itself.
5. Configure Secret Manager secrets for:
   - `STEAM_API_KEY` (optional, only for public nickname/avatar enrichment)
   - `DISCORD_CLIENT_SECRET`
   - `RCON_PASSWORD`
   - after the payment branch is approved: `PLATEGA_SECRET`
6. Run the deployment script from a trusted terminal with gcloud installed:
   ```bash
   export GCP_PROJECT_ID=YOUR_GCP_PROJECT_ID
   export FIREBASE_PROJECT_ID=YOUR_DEDICATED_FIREBASE_PROJECT_ID
   export RUNTIME_SERVICE_ACCOUNT=rustylub-backend@YOUR_PROJECT.iam.gserviceaccount.com
   export DISCORD_CLIENT_ID=YOUR_DISCORD_APPLICATION_ID
   export RCON_HOST=YOUR_RUST_RCON_HOST
   export RCON_PORT=443
   export RCON_PROTOCOL=wss
   export RCON_PASSWORD_SECRET_NAME=YOUR_RCON_SECRET_NAME
   # Optional, only if you configured a Serverless VPC Access connector and Cloud NAT:
   export VPC_CONNECTOR=YOUR_SERVERLESS_VPC_CONNECTOR
   export VPC_EGRESS=all-traffic
   export DISCORD_CLIENT_SECRET_SECRET_NAME=YOUR_DISCORD_SECRET_NAME
   export PLATEGA_SECRET_SECRET_NAME=YOUR_PLATEGA_SECRET_NAME
   # Payment release variables (set only after Platega approval and legal review):
   export PLATEGA_API_BASE=https://api.eu.payplatform.cc
   export PLATEGA_MERCHANT_ID=YOUR_MERCHANT_ID
   export PLATEGA_PAYMENT_METHOD=2
   export VIP_PRICE_RUB=YOUR_PRICE_IN_RUBLES
   export VIP_SCHEDULER_SERVICE_ACCOUNT=YOUR_SCHEDULER_SERVICE_ACCOUNT
   export LEGAL_DETAILS_COMPLETE=true
   # Optional: set BACKEND_PUBLIC_URL only after the Cloud Run custom domain mapping is created.
   # Optional:
   export STEAM_API_KEY_SECRET_NAME=YOUR_STEAM_API_SECRET_NAME
   bash backend/deploy-cloud-run.sh
   ```
7. The first run without BACKEND_PUBLIC_URL creates the Cloud Run service and prints its run.app URL. Then create the custom domain mapping:
   ```bash
   gcloud run domain-mappings create --service rusty-lub-auth --domain auth.rusty-lub.online --region YOUR_REGION --project YOUR_GCP_PROJECT_ID
   gcloud run domain-mappings describe --domain auth.rusty-lub.online --region YOUR_REGION --project YOUR_GCP_PROJECT_ID
   ```
   Add the exact DNS records returned by Google at REG.RU and wait until the custom domain certificate is ready. Then set BACKEND_PUBLIC_URL=https://auth.rusty-lub.online and run the deploy script a second time. This keeps OAuth state cookies same-site with the website. Set the same public URL as GitHub Actions Variable VITE_API_BASE_URL.
8. Configure Firestore TTL policies on the expiresAt field in steamAuthExchanges, steamOpenIdNonces, discordAuthStates and paymentLocks. Application code independently enforces expiration.

The Cloud Run service must allow unauthenticated invocation because Steam and Discord redirect callbacks arrive without a Firebase bearer token. Protected JSON endpoints still verify Firebase ID tokens, exact browser Origin, OAuth state and one-time codes. All credentials remain server-side.

## 3. Steam authentication

1. Deploy Cloud Run as above.
2. Open `https://auth.rusty-lub.online/healthz` (or your configured backend URL); expect `{"ok":true}`.
3. Test sign-in from `https://rusty-lub.online/account`: a first login should create Firebase UID `steam_<SteamID64>` and `users/{uid}`; a repeat login should resolve to the same account.
4. Verify logout, invalid OpenID response rejection, replayed nonce rejection and one-time exchange code rejection.
5. If a Steam Web API key is used, keep it in Secret Manager and map it only to server variable STEAM_API_KEY.

## 4. Discord account linking

1. Create/open the Discord application in the Developer Portal.
2. Add this exact OAuth2 redirect URL after Cloud Run deployment: `https://auth.rusty-lub.online/auth/discord/callback` (or the exact BACKEND_PUBLIC_URL you configured).
3. Set the application ID as DISCORD_CLIENT_ID on Cloud Run. Store the client secret in Secret Manager and map it to DISCORD_CLIENT_SECRET.
4. The implementation requests only the `identify` scope. It does not request guild membership, email, or bot permissions and does not persist the OAuth access token.
5. Test linking, relinking, unlinking and rejection when the Discord account is already linked to another Rusty.Lub profile.

## 5. Live server status and Vanilla RCON

1. Enable WebRCON in the Rust server panel and confirm the correct RCON host, port and password. Do not change gameplay settings or install Carbon/Oxide.
2. Do not expose plain `ws://` WebRCON over the public internet. Production backend deliberately rejects plaintext RCON. Use a hosting-provider secure WebSocket endpoint (`wss://`) or a TLS reverse proxy that forwards WebSocket upgrades to the private WebRCON port. The proxy hostname must have its own DNS record and a valid certificate; do not reuse the apex website record.
3. If you manage the host yourself, place Nginx/another TLS proxy in front of the local WebRCON listener, install a valid certificate for a dedicated hostname, preserve the request path, and allow inbound access only from the Cloud Run egress IP. Example Nginx location:
   ```nginx
   location / {
     proxy_pass http://127.0.0.1:26229;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "Upgrade";
     proxy_set_header Host $host;
     proxy_read_timeout 60s;
   }
   ```
4. Set RCON_PROTOCOL=wss, RCON_HOST to the TLS proxy hostname, RCON_PORT to its TLS port (usually 443), and store RCON_PASSWORD only in Secret Manager. Do not publish the RCON password in the browser or repository.
5. Optionally configure a Cloud Run Serverless VPC Access connector and Cloud NAT with a reserved static egress IP, then allowlist that IP at the TLS proxy. The deployment script accepts VPC_CONNECTOR and VPC_EGRESS. If you use this option, set VPC_EGRESS=all-traffic and keep the Cloud NAT IP fixed.
6. The public website requests only the read-only `serverinfo` command. Test `/public/server-status`; without secure RCON it intentionally displays “status unavailable” and VIP checkout remains disabled.

## 6. Platega activation (payment branch only)

The code is isolated in the payment release branch until its tests pass and the branch is merged. Do not configure or publish the callback before the merchant account is approved.

1. Obtain Merchant ID and API secret from Platega. Store the secret in Secret Manager as PLATEGA_SECRET; set PLATEGA_MERCHANT_ID and PLATEGA_API_BASE as Cloud Run environment variables.
2. Confirm with Platega that payment method 2 (SBP) is enabled for the merchant. The request sends the permanent SteamID64 as metadata.userId and SteamID64@mail.ru as metadata.user_email, a stable pseudonymous buyer identifier in the provider's required email-format field. It is not represented as the customer's real email. Obtain Platega's confirmation that this format is accepted for the merchant category before setting LEGAL_DETAILS_COMPLETE=true.
3. Set the merchant callback URL to `https://auth.rusty-lub.online/payments/platega/callback`.
4. Platega documents callback authentication with X-MerchantId and X-Secret headers, not an HMAC signature. The handler checks both values in constant time, then calls GET /transaction/{id} and verifies current status, merchant, amount, currency and order payload before granting anything. Duplicate status notifications and refund events are idempotent. For CONFIRMED, the backend first writes a durable grant_pending entitlement; if RCON is unavailable it returns 500 and the callback/Cloud Scheduler retry can complete the action.
5. The payment request sends the permanent SteamID64 as metadata.userId and SteamID64@mail.ru as metadata.user_email, following Platega guidance for a stable internal buyer ID when no email is collected. Confirm with the Platega manager that this metadata format and the selected payment method are accepted for your merchant category.
6. Create a dedicated Cloud Scheduler service account and set VIP_SCHEDULER_SERVICE_ACCOUNT to its email. Grant the service account roles/run.invoker on the Cloud Run service. Ensure the Cloud Scheduler service agent has roles/iam.serviceAccountTokenCreator on this scheduler service account. Create a Scheduler job with OIDC authentication (no shared secret):
   ```bash
   gcloud scheduler jobs create http rusty-lub-vip-reconcile \
     --location YOUR_REGION \
     --schedule "*/5 * * * *" \
     --time-zone "Etc/UTC" \
     --uri "https://auth.rusty-lub.online/internal/vip/reconcile" \
     --http-method POST \
     --oidc-service-account-email "YOUR_SCHEDULER_SERVICE_ACCOUNT" \
     --oidc-token-audience "https://auth.rusty-lub.online/internal/vip/reconcile"
   ```
   Confirm the Cloud Scheduler service agent can mint OIDC tokens for that service account. The backend verifies the Google-signed token and exact service-account email.
7. Before setting LEGAL_DETAILS_COMPLETE=true, publish the final seller/operator identity, tax details, service contact, approved price and reviewed refund/cancellation terms on the legal pages. This gate keeps the checkout endpoint disabled until those details are complete.
8. Test native Rust RCON commands on a non-production/test SteamID64 first. Check that the SteamID64 does not already have a manually assigned queue-skip permission; Rust stores this as a single permission and automatic expiry could remove an independently granted right. Test issue, server.writecfg, reconnect, seven-day expiry and removals before sales.
9. Run the payment tests in CI. Use a provider test payment or a low-value approved live test only after the merchant has confirmed the callback configuration.
10. For a refund request, verify the order and entitlement in Firestore, process the refund in the Platega merchant dashboard, then verify the provider callback changes the order status and revokes the native queue permission on full refund or chargeback. Partial refunds do not automatically revoke a pass unless the provider reports the full amount refunded.
11. Confirm the seven-day VIP Queue Pass wording, price, tax and operator details on the legal pages before opening checkout.

## 7. Domain and HTTPS

The repository uses a custom GitHub Actions Pages workflow. The `public/CNAME` file alone does not set the Pages custom domain.

1. Open GitHub → RustyLub/GAME-SERVER → Settings → Pages.
2. Under Custom domain, set `rusty-lub.online` and save.
3. At REG.RU, set the apex A records to GitHub Pages:
   - 185.199.108.153
   - 185.199.109.153
   - 185.199.110.153
   - 185.199.111.153
4. Remove conflicting old apex A records, including the previous hosting address if it is still present. Do not change MX, SPF, DKIM, DMARC or `long.rusty-lub.online`, which points to the game server.
5. If you want `www.rusty-lub.online`, add a CNAME for host `www` pointing directly to `RustyLub.github.io`.
6. Wait for DNS propagation and GitHub Pages certificate issuance. Then enable Enforce HTTPS in Settings → Pages. GitHub Pages performs HTTP → HTTPS redirection after this is enabled.
7. Verify with `Resolve-DnsName rusty-lub.online`, `curl -I http://rusty-lub.online` and `curl -I https://rusty-lub.online`. Confirm the certificate name, validity and redirect destination.

## 8. Legal and commercial publication

1. Before checkout is enabled, fill in the seller/operator identity, legal address/contact details required by the applicable law, tax status and payment recipient details. These are intentionally not invented in repository text.
2. Have the Privacy Policy, Terms, cancellation and refund clauses reviewed for the actual operator jurisdiction and Platega merchant agreement.
3. The project is explicitly unofficial and not affiliated with Facepunch Studios.
4. No analytics or advertising cookies are currently installed. If analytics or other non-essential cookies are introduced, add a consent manager before enabling them and update the Privacy Policy.
5. Verify the product description: a one-time 7-day queue-skip entitlement only; no game items, boosted rates or guarantee of a free server slot. The Rust server remains Vanilla and uses native Rust commands over RCON.

## 9. SEO and social preview

1. After the domain and HTTPS are active, open the home page source and confirm canonical, title, description, Open Graph and Twitter metadata.
2. Test the public RU and EN OG image URLs:
   - `https://rusty-lub.online/og-ru.svg`
   - `https://rusty-lub.online/og-en.svg`
3. Submit the homepage to the Facebook Sharing Debugger and LinkedIn Post Inspector to refresh cached previews. Some social crawlers may not support SVG Open Graph images; if a target platform rejects SVG, replace them with 1200×630 PNGs without changing the metadata URLs.
4. Submit `https://rusty-lub.online/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## 10. Final acceptance

- [ ] RU/EN routes and language switch work, including the 404 fallback.
- [ ] Home shows the configured server address, copy action, Steam connect link, next wipe and server status.
- [ ] Steam sign-in, repeat sign-in and logout pass against the real Firebase project.
- [ ] Discord link/unlink and unique-account enforcement pass.
- [ ] Firestore owner-only profile and order reads are verified against the deployed rules.
- [ ] Platega callback and payment tests pass before checkout is opened.
- [ ] RCON status works without installing any game plugin.
- [ ] DNS, TLS certificate, HTTPS redirect and social previews are verified.
- [ ] Legal operator details are completed and reviewed.
