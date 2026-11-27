# Rusty.Lub GAME-SERVER — architecture and release boundary

## Product

The public site serves Rusty.Lub EU Long in Russian and English. It is a React 19 + TypeScript + Vite static application hosted by GitHub Pages. The game server is strictly Vanilla: no Carbon, Oxide/uMod or other plugins are installed or required.

## Runtime

- Frontend: React 19, TypeScript, Vite 8 and Firebase Web SDK.
- Static hosting: GitHub Pages through .github/workflows/deploy-pages.yml.
- Trusted backend: Node.js 22+, Express and Firebase Admin on Google Cloud Run.
- Data: Firebase Authentication and Cloud Firestore.
- Steam authentication: server-side Steam OpenID 2.0 verification followed by Firebase Custom Token issuance.
- Discord linking: server-side OAuth2 authorization-code flow, identify scope only.
- Live server status: read-only Rust WebRCON serverinfo command over secure WSS; unavailable until the TLS endpoint and RCON credentials are configured.
- VIP queue: native Rust queue permission through backend RCON only; no game plugin.

GitHub Pages cannot run backend code or store server secrets. It only serves static files.

## Identity and data access

Firebase user IDs are stable and derived from the verified SteamID64: steam_<SteamID64>. The backend creates and updates users/{uid}. The browser may:
- read only its own profile;
- update only its own customDisplayName (2–24 characters);
- read only order documents whose userId equals the authenticated UID.

The browser cannot create, delete or modify orders, entitlements, payment events, payment locks, OAuth state, nonces or other internal documents. Firestore rules deny all other client access. The backend uses Firebase Admin under a dedicated Cloud Run service account.

Steam OpenID assertions are checked server-to-server, signed fields and claimed identity are validated, response nonces are one-time, and the browser receives only a short-lived one-time code. The Firebase Custom Token remains in Firestore and is exchanged once by the frontend.

Discord linking uses an expiring state cookie plus a one-time Firestore state record bound to the authenticated Steam UID. Discord identity is unique across Rusty.Lub accounts. Access tokens are discarded after fetching the Discord identity; no bot permissions are requested.

## Secrets

Public browser configuration:
- VITE_FIREBASE_* (Firebase Web App public config)
- VITE_API_BASE_URL (public backend URL)

Server-only values:
- Firebase Admin IAM identity
- Steam Web API key (optional)
- Discord client secret
- RCON password
- Platega secret and other payment credentials when the payment branch is approved and merged

Never place server secrets in frontend code, VITE_ variables, GitHub Actions Variables, source files or committed .env files. Use Cloud Run secret mappings / Google Secret Manager. The repository contains empty .env.example templates only.

## Routes and SEO

The site prerenders all public Russian and English routes, with per-route title, description, canonical, Open Graph and Twitter metadata. Account, account-linking, store and leaderboard routes are noindex where appropriate. RU and EN 404 pages are generated separately. Sitemap contains public pages only. The leaderboard remains a clear “Скоро” placeholder until verified game statistics are available.

## Payment isolation

Payment creation and Platega webhook handling live in a dedicated payment release branch and are merged only after the full build and payment test suite are green. The callback checks Platega's documented X-MerchantId/X-Secret headers, then independently fetches the transaction and verifies merchant, amount, currency and order payload. Duplicate notifications are idempotent. VIP entitlements use native Rust queue commands over WSS-protected RCON; Cloud Scheduler OIDC drives retries and expiry. The game server remains Vanilla.

## Current release limitations

- Firebase and Cloud Run are not live until the project and console setup in docs/MANUAL_STEPS.md is completed.
- Discord OAuth requires a registered application and Cloud Run secret.
- Live online status requires WebRCON to be enabled and its server-only credentials configured.
- Platega checkout requires merchant approval, Secret Manager mappings, verified callback configuration, Cloud Scheduler OIDC and completed legal operator details. Checkout is disabled unless LEGAL_DETAILS_COMPLETE=true.
- DNS, custom domain and HTTPS must be verified in GitHub Pages and REG.RU.

## Repository map

- src/ — bilingual website, Firebase client, account UI.
- backend/ — Steam/Discord auth and read-only WebRCON status service.
- public/ — favicon, OG artwork, CNAME, robots.txt and sitemap.xml.
- scripts/ — prerendering and release checks.
- firestore.rules / firestore.indexes.json — client security and query index definitions.
- docs/MANUAL_STEPS.md — external console, DNS, legal and release actions.
