# Firebase setup — GAME-SERVER

## Project boundary

For this rollout, reuse the existing Rusty.Lub Firebase project `rustylub` and its existing Web App configuration exactly as previously supplied. Do not create a replacement project or rotate these public client values. The code and `.env.example` include these defaults; GitHub Actions Variables and local `.env` values may override them later.

## Firebase Web App

Select the existing Web App in Firebase Console → Project settings → General. Do not create a duplicate unless the current Web App is missing. The six current Firebase values are already wired into the frontend defaults. The backend origin `VITE_API_BASE_URL` intentionally remains unset until the Firebase Hosting auth proxy custom domain is live. If you prefer to manage the six Firebase values through GitHub Actions repository Variables, set:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

These values are public browser configuration, not secrets. Never place Firebase Admin credentials, service-account JSON, Steam API keys, Discord client secret, Platega secret or RCON password in VITE_ variables.

## Authentication

Enable Firebase Authentication. Steam sign-in uses server-verified Steam OpenID and Firebase Custom Tokens. No Email/Password provider is required. Add both `rusty-lub.online` and `rusty-lub.ru` to Authentication → Settings → Authorized domains. Keep the existing `rustylub.firebaseapp.com` auth domain.

The backend creates stable UIDs in the form steam_<SteamID64>. Discord is linked as an additional profile identity, not a second login provider.

## Firestore

Use the existing Cloud Firestore database in project `rustylub`. Before deploying the repository rules, export/backup the current rules and inspect existing data because deployment replaces the active rules. Then publish the reviewed rules and indexes from the repository root:

    firebase login
    firebase use --add
    firebase deploy --only firestore:rules,firestore:indexes --project rustylub

Rules permit:
- get only users/{uid} where request.auth.uid == uid;
- update only the user's customDisplayName field, with a 2–24 character limit;
- read only orders whose userId equals the signed-in UID.

Rules deny browser profile creation/deletion, all order writes, payment and entitlement writes, OAuth state, nonce, Discord mapping and all other internal collection access. Firebase Admin in Cloud Run performs trusted writes.

## Backend collections

- users/{uid} — Steam profile and optional Discord link.
- steamAuthExchanges/{sha256(code)} — one-time Firebase token exchange.
- steamOpenIdNonces/{sha256(nonce)} — Steam OpenID replay protection.
- discordAuthStates/{sha256(state)} — one-time Discord OAuth state.
- discordLinks/{discordId} — unique Discord-to-Steam UID mapping.
- orders/{orderId} — server-created Platega orders; owner-readable, client-write denied.
- paymentRequests/{hash} — checkout idempotency records.
- paymentEvents/{eventKey} — deduplicated provider callback and refund events.
- entitlements/{orderId} — server-managed VIP Queue Pass state and expiry.
- paymentLocks/{uid} — per-user checkout lock with expiry.

Configure Firestore TTL on `expiresAt` for `steamAuthExchanges`, `steamOpenIdNonces`, `discordAuthStates` and `paymentLocks`. TTL is cleanup only; backend code independently checks expiration and never relies on TTL deletion for authorization or payment state.

## Acceptance checks

- First Steam login creates one Firebase identity and profile.
- Repeated login resolves to the same UID.
- A user can read only their own profile and orders.
- A user can update only their own customDisplayName.
- A user cannot create, delete or alter order documents.
- A user cannot read another profile, internal state, entitlements or payment events.
- Discord identity is unique and cannot be linked to another UID.
- Logout ends the Firebase session.


## Set GitHub Actions Variables from a local JSON file

Only after `auth.rusty-lub.online` is live, you can export the Web App configuration object from Firebase Console as JSON and save it locally as `firebase-config.local.json` in the repository root. This helper is optional because the six existing public values already have source defaults. This filename is ignored by Git. Then, from the repository root, run:

    node scripts/configure-github-variables.mjs firebase-config.local.json https://auth.rusty-lub.online --dry-run
    node scripts/configure-github-variables.mjs firebase-config.local.json https://auth.rusty-lub.online

The helper validates all six Firebase fields and the HTTPS backend origin, then writes the seven public values as GitHub Actions repository Variables using the authenticated GitHub CLI. It never prints the values and never creates or changes GitHub Secrets. Install GitHub CLI and authenticate with `gh auth login` first. Do not put service-account JSON or private keys in this file.
