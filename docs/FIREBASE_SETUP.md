# Firebase setup — GAME-SERVER

## Project boundary

Use a dedicated Firebase project for Rusty.Lub GAME-SERVER. Do not assume or silently reuse the legacy Rusty.Lub project. The browser Firebase SDK remains uninitialized until the six Web App configuration variables are supplied.

## Firebase Web App

Create/select the Web App in Firebase Console → Project settings → General. Set these GitHub Actions repository Variables:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

These values are public browser configuration, not secrets. Never place Firebase Admin credentials, service-account JSON, Steam API keys, Discord client secret, Platega secret or RCON password in VITE_ variables.

## Authentication

Enable Firebase Authentication. Steam sign-in uses server-verified Steam OpenID and Firebase Custom Tokens. No Email/Password provider is required. Add rusty-lub.online to Authentication → Settings → Authorized domains.

The backend creates stable UIDs in the form steam_<SteamID64>. Discord is linked as an additional profile identity, not a second login provider.

## Firestore

Create Cloud Firestore in Production mode, then publish the committed rules and indexes from the repository root:

    firebase login
    firebase use --add
    firebase deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID

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

You can export the Web App configuration object from Firebase Console as JSON and save it locally as `firebase-config.local.json` in the repository root. This filename is ignored by Git. Then, from the repository root, run:

    node scripts/configure-github-variables.mjs firebase-config.local.json https://auth.rusty-lub.online --dry-run
    node scripts/configure-github-variables.mjs firebase-config.local.json https://auth.rusty-lub.online

The helper validates all six Firebase fields and the HTTPS backend origin, then writes the seven public values as GitHub Actions repository Variables using the authenticated GitHub CLI. It never prints the values and never creates or changes GitHub Secrets. Install GitHub CLI and authenticate with `gh auth login` first. Do not put service-account JSON or private keys in this file.
