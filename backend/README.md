# Rusty.Lub Steam authentication backend

This service is the trusted server-side part of Steam-only account authentication. The public React site remains on GitHub Pages; this Node.js service must be deployed separately to Google Cloud Run.

## Current scope

- Steam OpenID 2.0 verification and Firebase Custom Token issuance.
- Automatic Firebase identity and profile creation on first successful Steam login.
- Owner-only profile reads; browser-side profile writes are denied by Firestore rules.
- No payment, Platega, webhook, VIP entitlement, RCON, or Carbon endpoints are included in the production branch.
- The Rust game server remains Vanilla and receives no plugin.

## Security model

- Steam OpenID is verified server-to-server using Steam's check_authentication endpoint.
- The callback is bound to a random HttpOnly, Secure, SameSite=Lax state cookie and an exact configured return URL.
- SteamID64 is accepted only from the canonical verified claimed_id; the identifier range and signed OpenID fields are checked.
- OpenID response nonces are time-bounded and recorded once to prevent replay.
- Firebase users use stable UIDs in the form steam_<SteamID64>; no email/password account creation is provided.
- Firebase Admin creates/updates the user and writes the profile. Firestore client rules deny profile writes and all non-profile access.
- A random one-time exchange code is stored only as a SHA-256 hash, expires after two minutes, and is consumed transactionally. The Firebase custom token is never placed in the redirect URL.
- The exchange endpoint requires the exact configured frontend Origin and JSON content type.
- The frontend uses a no-referrer policy so the one-time callback code is not leaked through referrer headers.
- Firebase Admin credentials and the optional Steam Web API key stay on the server. No secret uses a VITE_ variable.

## Required environment

Set these values in Cloud Run environment configuration:
- FRONTEND_ORIGIN=https://rusty-lub.online
- BACKEND_PUBLIC_URL=https://<the-final-cloud-run-service-url>
- FIREBASE_PROJECT_ID=<the-dedicated-GAME-SERVER-firebase-project-id>
- FIREBASE_SERVICE_ACCOUNT_EMAIL=<runtime-service-account-email>
- PORT=8080 (provided automatically by Cloud Run)
- STEAM_API_KEY (optional; only used to show current Steam nickname and avatar)

Do not assume the Firebase project ID. This repository must use the dedicated GAME-SERVER Firebase project, separate from the legacy website project. Confirm the project in Firebase Console before deployment.

## Google Cloud setup

1. Select the Google Cloud project that owns the dedicated GAME-SERVER Firebase project. Enable Cloud Run, Cloud Build, Artifact Registry, IAM Credentials, Firebase Authentication and Firestore APIs as required by the project.
2. Configure billing and choose a Cloud Run region. A European region is recommended for the EU server audience.
3. Create a dedicated runtime service account for this service.
4. Grant the runtime identity only the required project permissions: Firebase Authentication user administration (roles/firebaseauth.admin), Firestore data access (roles/datastore.user), and Service Account Token Creator (roles/iam.serviceAccountTokenCreator) on the runtime service account itself so Firebase Admin can mint custom tokens through IAM signing.
5. Deploy the backend directory as a public Cloud Run service. The Steam redirect and callback must be reachable without a Firebase user session, so the service needs unauthenticated invocation; the application endpoints themselves validate state and exact Origin.
6. Set FRONTEND_ORIGIN, FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_EMAIL as server environment variables. Set BACKEND_PUBLIC_URL to an HTTPS placeholder for the first deployment, then read the generated Cloud Run URL and redeploy with that exact URL.
7. If a Steam Web API key is used, store it in Google Secret Manager and expose it to Cloud Run as a server-side secret. The key is optional; sign-in still works without nickname/avatar enrichment.
8. Set the public backend URL as the GitHub repository Actions Variable VITE_API_BASE_URL. This URL is not a secret. Do not put Firebase Admin credentials, Steam API keys, RCON passwords or any other secret in GitHub Actions Variables or frontend build variables.
9. Add rusty-lub.online to Firebase Authentication authorized domains. Confirm that the Firebase project selected is the dedicated GAME-SERVER project.
10. Configure Firestore TTL policies for expiresAt in steamAuthExchanges and steamOpenIdNonces. TTL is storage cleanup; the application independently enforces expiration.

Example deployment flow (replace the project, region and service-account values with the confirmed values):

- Select project: gcloud config set project YOUR_GCP_PROJECT_ID
- First deploy: gcloud run deploy rusty-lub-auth --source backend --region YOUR_REGION --service-account YOUR_RUNTIME_SERVICE_ACCOUNT --allow-unauthenticated --set-env-vars FRONTEND_ORIGIN=https://rusty-lub.online,BACKEND_PUBLIC_URL=https://placeholder.invalid,FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID,FIREBASE_SERVICE_ACCOUNT_EMAIL=YOUR_RUNTIME_SERVICE_ACCOUNT
- Read service URL: gcloud run services describe rusty-lub-auth --region YOUR_REGION --format=value(status.url)
- Redeploy with BACKEND_PUBLIC_URL set to the exact service URL returned above.

Never put service-account JSON, private keys, Steam API keys, payment secrets or RCON credentials in Git. Do not add secrets to frontend VITE_ variables.

## Local checks

From this directory:
- npm install
- npm test
- npm start

For local HTTP testing, use NODE_ENV=development, FRONTEND_ORIGIN=http://localhost:5173, BACKEND_PUBLIC_URL=http://localhost:8080 and a test Firebase project or emulator. A real Steam OpenID callback still requires an externally reachable HTTPS endpoint.

## End-to-end acceptance checklist

- [ ] New Steam account creates one Firebase identity and users/{uid} profile.
- [ ] Repeat login opens the same profile.
- [ ] SteamID64 is taken only from the verified OpenID claim.
- [ ] A substituted SteamID64 or invalid OpenID signature is rejected.
- [ ] A replayed OpenID nonce is rejected.
- [ ] A replayed or expired one-time exchange code is rejected.
- [ ] A user cannot read another user's profile or write any profile field through Firestore SDK.
- [ ] Logout ends the Firebase session.
- [ ] Cloud Run health check returns { "ok": true }.
