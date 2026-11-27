# Rusty.Lub Steam authentication backend

This service is the trusted server-side part of Steam-only account authentication. The public React site remains on GitHub Pages; this Node.js service must be deployed separately.

## Security model

- Steam OpenID 2.0 is verified server-to-server using Steam's `check_authentication` endpoint.
- The callback is bound to a random, HttpOnly, Secure, SameSite=Lax state cookie and an exact configured return URL.
- The SteamID64 is accepted only from the canonical, verified `claimed_id`; the identifier range and signed OpenID fields are checked.
- OpenID response nonces are time-bounded and recorded once to prevent replay.
- Firebase users use stable UIDs `steam_<SteamID64>`; there is no email/password account creation.
- Firebase Admin creates/updates the user and writes the profile. Firestore client rules deny profile writes.
- A random one-time exchange code is stored only as a SHA-256 hash, expires after two minutes, and is consumed transactionally. The Firebase custom token is never placed in the redirect URL.
- The exchange endpoint requires the exact configured frontend Origin.
- The frontend uses a no-referrer policy so the one-time callback code is not leaked through referrer headers.

## Required environment

Copy `.env.example` to your deployment configuration. Set:
- `FRONTEND_ORIGIN=https://rusty-lub.online`
- `BACKEND_PUBLIC_URL=https://<your-real-backend-host>`
- `FIREBASE_PROJECT_ID=rustylub`
- `FIREBASE_SERVICE_ACCOUNT_EMAIL=<runtime-service-account-email>`
- `PORT=8080` (provided automatically by Cloud Run)
- `STEAM_API_KEY` (optional; used only to show Steam display name and avatar; without it authentication still works but the profile falls back to a generic label)

The runtime identity must have Firebase Authentication Admin (`roles/firebaseauth.admin`) and Firestore data access (`roles/datastore.user`) in project `rustylub`. Set `FIREBASE_SERVICE_ACCOUNT_EMAIL` to the runtime service account email and grant that identity Service Account Token Creator (`roles/iam.serviceAccountTokenCreator`) on itself so the Admin SDK can mint Firebase custom tokens using IAM signing. Do not upload a service-account JSON file into Git or the container.

## Local checks

From this directory:
```sh
npm install
npm test
npm start
```

For local HTTP testing, set `NODE_ENV=development`, `FRONTEND_ORIGIN=http://localhost:5173`, and `BACKEND_PUBLIC_URL=http://localhost:8080`. Steam's OpenID callback is still a real external Steam flow.

## Deploy to Google Cloud Run

A Google Cloud project, Cloud Run permissions, billing configuration, and a service account are required. These are account-level operations and are intentionally not performed automatically.

1. Enable Cloud Run and configure billing in the chosen Google Cloud project.
2. Create a runtime service account and grant only Firebase Authentication user management and Firestore data access for project `rustylub`.
3. Deploy this directory as a Cloud Run service, set the environment variables above, and bind the runtime service account. Set `FIREBASE_SERVICE_ACCOUNT_EMAIL` to the bound service account email.
4. Set `BACKEND_PUBLIC_URL` to the final HTTPS service URL and redeploy.
5. Set GitHub repository variable `VITE_API_BASE_URL` to that HTTPS URL so the Pages build enables the Steam button.
6. Add `rusty-lub.online` to Firebase Authentication authorized domains. Do not enable Email/Password as a Rusty.Lub sign-in method.
7. Test first-time account creation, repeat login, invalid OpenID claims, replayed exchange codes, and logout before production use.

In Firestore, configure TTL policies on the `expiresAt` field for the `steamAuthExchanges` and `steamOpenIdNonces` collections so expired one-time codes and replay-prevention records are cleaned up automatically. Expiry is also enforced by application code; TTL is storage cleanup.

The service cannot be considered live until it has been deployed and these checks pass. Do not expose Firebase Admin credentials, Steam API keys, or game-server RCON secrets in frontend variables.

## VIP Queue Pass and Platega

The backend includes a seven-day VIP Queue Pass checkout flow. The pass is tied to the SteamID64 in the verified Firebase custom-token claims; the browser cannot choose another player's SteamID. The configured price is read only from `VIP_PRICE_RUB`. Checkout stays disabled until all four values are present and the Carbon plugin has sent a recent heartbeat:

- `PLATEGA_MERCHANT_ID`
- `PLATEGA_SECRET`
- `VIP_PRICE_RUB` (whole RUB amount)
- `CARBON_SYNC_SECRET` (same long random value as the Carbon plugin config)

Also set `PLATEGA_API_BASE=https://api.eu.payplatform.cc` (the European Platega API host). Do not place any Platega credential in Vite variables or the frontend.

### Platega callback setup

Set the merchant's single Callback URL to:

```
https://<your-real-backend-host>/payments/platega/callback
```

The callback handler checks both `X-MerchantId` and `X-Secret` using constant-time comparison, checks the order payload, and independently retrieves the current transaction from Platega before granting an entitlement. It checks the exact configured amount and RUB currency. It uses the Platega transaction ID as the idempotency key, so repeated callbacks cannot add extra seven-day periods.

The Platega payment API currently uses `POST /v2/transaction/process` with `X-MerchantId` and `X-Secret`. The customer identity metadata is stable and tied to SteamID64. A browser return URL is never treated as proof of payment.

### Firestore collections

- `vipOrders/{transactionId}` — pending order and provider state.
- `vipPayments/{transactionId}` — one record per confirmed Platega transaction.
- `vipEntitlements/{steamId64}` — current entitlement and expiry; a renewal extends from the later of now or the existing expiry.
- `vipDeliveryQueue/{transactionId}` — durable request for Carbon delivery. New grants are marked `pending` and the entitlement is `pending_delivery` until a trusted game-server integration acknowledges delivery.

The callback marks chargebacks, partial refunds and disputes for review instead of silently treating them as ordinary successful payments. The repository includes a Carbon-side worker for grant and expiry jobs; it must still be installed, configured and tested on the actual Rust/Carbon server before VIP can be considered live.

### Important activation boundary

A confirmed Platega payment creates the seven-day entitlement and a pending Carbon delivery job. It does **not** directly issue an RCON command from the public website. Do not advertise the pass as live until the Carbon worker is installed and verified to consume the queue, execute the server-supported queue-skip and expiry-removal commands, and acknowledge jobs.

## Carbon delivery bridge

The backend exposes a narrow queue API for the Rust server plugin:

- `GET /internal/carbon/jobs`
- `POST /internal/carbon/ack`

Both require `Authorization: Bearer <CARBON_SYNC_SECRET>`. Set the same long random value in the backend secret manager and the Carbon plugin config. This secret is never sent to the website. The backend leases jobs for 60 seconds and retries unacknowledged jobs after the lease expires.

The plugin file is `carbon/RustyLubVipQueue.cs`. Install it in the server's `carbon/plugins` directory, configure its API URL and shared secret, then watch the Carbon console logs. The plugin polls every 15 seconds; each authenticated poll refreshes a backend heartbeat. VIP checkout remains disabled unless that heartbeat is newer than 90 seconds, so the website will not accept a new payment while the Carbon bridge is offline. It executes only fixed Rust commands with a validated 17-digit SteamID64:

- Grant: `global.skipqueueid <SteamID64> "Rusty.Lub VIP" "7-day pass"`
- Expire: `global.removeskipqueue <SteamID64>`
- It runs `server.writecfg` after changes so queue permissions persist.

The backend creates one expiry schedule per SteamID64 and renewals move that schedule forward. The plugin must be tested on the actual Rust/Carbon build before accepting payments. A successful HTTP acknowledgement means the command was submitted by the plugin; it is not a substitute for a live server-side verification test.
