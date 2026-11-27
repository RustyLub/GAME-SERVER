# Rusty.Lub trusted backend

Node.js 22+ / Express service deployed separately to Google Cloud Run. It provides Steam OpenID authentication, Discord account linking and optional read-only Rust WebRCON status.

## Runtime routes

- GET /healthz — service health.
- GET /auth/steam — starts Steam OpenID.
- GET /auth/steam/callback — verifies the OpenID assertion, creates the Firebase profile and issues a short-lived exchange code.
- POST /auth/steam/exchange — consumes the one-time exchange code and returns a Firebase Custom Token.
- POST /auth/discord/start — requires a Firebase bearer token and returns a Discord OAuth authorization URL.
- GET /auth/discord/callback — validates the state cookie and Firestore state record, exchanges the code, and binds a unique Discord ID to the Steam profile.
- POST /auth/discord/unlink — removes the current user's Discord mapping.
- GET /public/server-status — optional read-only WebRCON serverinfo query; returns unavailable if RCON is not configured or unreachable.
- GET /vip/config — public availability and price configuration (no secrets).
- GET /vip/me — current user entitlement, requires Firebase bearer token.
- POST /payments/orders — create an idempotent Platega checkout order, requires Firebase bearer token.
- POST /payments/platega/callback — verifies Platega headers and authoritative transaction state, then updates order and VIP entitlement.
- POST /internal/vip/reconcile — verifies a Google-signed Cloud Scheduler OIDC token and retries grants/revocations and seven-day expiry.

Payment routes create a Platega transaction, verify callbacks using the documented X-MerchantId/X-Secret headers and a server-side GET transaction check, then issue a 7-day native Rust queue-skip permission through RCON. Callback events and RCON retries are idempotent. Expiry and dispute/chargeback revocation run through a Cloud Scheduler OIDC worker. No Carbon or Oxide plugin is involved.

## Security

- Steam OpenID response is verified against Steam's check_authentication endpoint.
- Steam state uses a random HttpOnly Secure SameSite=Lax cookie and exact callback URL.
- Claimed SteamID64 must be canonical, in range and match signed OpenID identity fields.
- Nonces and exchange codes are one-time Firestore records with enforced expiration.
- Firebase UID is steam_<SteamID64>; Admin SDK creates the user and profile.
- Discord OAuth requests only identify. State is bound to the authenticated Steam UID; one Discord ID cannot be linked to multiple profiles. Access tokens are discarded after profile lookup.
- CORS allows only the exact frontend origin and credentials for the same-site auth subdomain.
- The RCON password is server-only. The public status route exposes only parsed online/player counts and never arbitrary command execution.
- No privileged secret is exposed via VITE_ variables.

## Required server environment

- PORT=8080
- NODE_ENV=production
- FRONTEND_ORIGIN=https://rusty-lub.online
- BACKEND_PUBLIC_URL=https://auth.rusty-lub.online (recommended same-site Cloud Run custom domain)
- FIREBASE_PROJECT_ID=<dedicated Firebase project>
- FIREBASE_SERVICE_ACCOUNT_EMAIL=<Cloud Run runtime service account>
- DISCORD_CLIENT_ID=<Discord application ID>
- DISCORD_CLIENT_SECRET=<Secret Manager mapping>
- DISCORD_REDIRECT_URI=<BACKEND_PUBLIC_URL>/auth/discord/callback
- RCON_HOST / RCON_PORT (optional)
- RCON_PASSWORD (Secret Manager mapping; required for live status and VIP)
- PLATEGA_API_BASE, PLATEGA_MERCHANT_ID, PLATEGA_PAYMENT_METHOD, VIP_PRICE_RUB
- PLATEGA_SECRET (Secret Manager mapping)
- VIP_SCHEDULER_SERVICE_ACCOUNT (Google service account email used for OIDC scheduler requests)
- LEGAL_DETAILS_COMPLETE=true only after seller identity, tax and refund terms are completed and reviewed
- STEAM_API_KEY (optional Secret Manager mapping)

## Cloud Run IAM

Use a dedicated runtime service account. Grant only:
- roles/firebaseauth.admin
- roles/datastore.user
- roles/iam.serviceAccountTokenCreator on the runtime service account itself, so Firebase Admin can sign custom tokens through IAM.

Cloud Run must allow unauthenticated invocation for external OAuth callbacks. Application endpoints still validate exact Origin, OAuth state and Firebase bearer tokens where required.

## Deploy

1. Follow docs/MANUAL_STEPS.md to choose the correct Firebase project, create the service account, configure IAM and create Secret Manager entries.
2. First deploy without BACKEND_PUBLIC_URL to create the Cloud Run service and obtain its run.app URL:
   - export GCP_PROJECT_ID, FIREBASE_PROJECT_ID and RUNTIME_SERVICE_ACCOUNT
   - run bash backend/deploy-cloud-run.sh
3. Create a Cloud Run domain mapping for auth.rusty-lub.online. Add the DNS records returned by Google and wait for the certificate.
4. Export BACKEND_PUBLIC_URL=https://auth.rusty-lub.online and run the deploy script again. This makes Steam/Discord callback URLs and OAuth cookies same-site with the frontend.
5. Register the Discord redirect URL exactly as https://auth.rusty-lub.online/auth/discord/callback.
6. Set GitHub Actions Variable VITE_API_BASE_URL to https://auth.rusty-lub.online.

The deployment script accepts secret names, not secret values:
- STEAM_API_KEY_SECRET_NAME
- DISCORD_CLIENT_SECRET_SECRET_NAME
- RCON_PASSWORD_SECRET_NAME
- PLATEGA_SECRET_SECRET_NAME

It maps these Secret Manager versions into Cloud Run without writing secrets to the repository.

## Local checks

- npm install
- npm test
- npm start

A real Steam callback requires a publicly reachable HTTPS URL and the configured Firebase project. Do not treat unit tests as a substitute for a live end-to-end sign-in.

## Firestore collections and TTL

- users/{uid}
- steamAuthExchanges/{sha256(code)}
- steamOpenIdNonces/{sha256(nonce)}
- discordAuthStates/{sha256(state)}
- discordLinks/{discordId}

Configure TTL on expiresAt for steamAuthExchanges, steamOpenIdNonces, discordAuthStates and paymentLocks. Application code independently checks expiration.

