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
