# Firebase setup for Rusty.Lub GAME-SERVER

The website supports Steam-only sign-in. Registration is automatic after a successful Steam OpenID login. Email/password registration is not part of this project.

## 1. Select the correct Firebase project

This repository must use a dedicated Firebase project for GAME-SERVER, separate from the legacy Rusty.Lub website project. Do not use a remembered project ID or copy a config from another site without confirming it in Firebase Console.

The repository intentionally has no hard-coded Firebase project fallback. Until the dedicated project is confirmed and its Web App config is supplied, Firebase Auth and Firestore remain uninitialized in the browser.

## 2. Firebase Web App

In Firebase Console, open Project settings → General → Your apps and create or select the Web App belonging to the dedicated GAME-SERVER project.

The Web App configuration values are public client configuration. Set the following GitHub repository Actions Variables for production builds, or place them in a local untracked .env.local file:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

These values are visible in the browser bundle and are not secrets. Never place Firebase Admin credentials, service-account JSON, private keys, Steam API keys or RCON credentials in VITE_ variables.

## 3. Firebase Authentication

Firebase Authentication is the session layer for Firebase Custom Tokens issued by the trusted backend after Steam OpenID verification.

- Add rusty-lub.online to Authentication → Settings → Authorized domains.
- Do not enable Email/Password for Rusty.Lub login.
- The backend creates Firebase users with stable UIDs steam_<SteamID64>.
- Steam is not a built-in Firebase OAuth provider in this flow; the backend validates Steam OpenID and then issues a Firebase Custom Token.

## 4. Cloud Firestore

Create Firestore Database in Production mode. The committed firestore.rules file allows a signed-in user to get only their own users/{uid} profile. Listing users, writing profiles, and all other client reads/writes are denied.

Publish rules only after confirming the correct Firebase project:
- firebase use --add
- select the dedicated GAME-SERVER project
- firebase deploy --only firestore:rules

The trusted backend uses Firebase Admin SDK and IAM. Admin SDK access bypasses client rules and is restricted by the Cloud Run runtime service account's IAM permissions.

## 5. Required backend collections

The Steam authentication service uses:
- users/{uid} for the profile created by the trusted backend;
- steamAuthExchanges/{sha256(code)} for one-time Firebase Custom Token exchange records;
- steamOpenIdNonces/{sha256(nonce)} to prevent replay of a previously accepted Steam assertion.

Configure Firestore TTL on expiresAt for steamAuthExchanges and steamOpenIdNonces. Application code still checks expiration and does not rely on TTL timing.

## 6. Verification

- A first successful Steam login creates one Firebase identity and one profile.
- A repeat login resolves to the same identity.
- A modified or non-canonical claimed_id is rejected.
- A replayed nonce or exchange code is rejected.
- A signed-in user can read only their own profile.
- Client writes to users and all access to internal collections are denied.
- Logout clears the Firebase client session.

Do not mark Firebase as connected until the project selection, Authentication domain, Firestore database, published rules and end-to-end login have all been checked in the actual Firebase project.
