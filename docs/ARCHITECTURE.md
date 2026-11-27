# Rusty.Lub GAME-SERVER — architecture

## Product boundary

This repository contains the public Rusty.Lub EU Long website. It is independent from the legacy Rusty.Lub website and must use a separate Firebase project. The production frontend is a static React application hosted on GitHub Pages at `https://rusty-lub.online/`.

## Runtime and delivery

- Node.js 22 is the development and CI runtime (`.nvmrc`).
- React 19 + TypeScript + Vite build the browser application.
- `npm run build` runs TypeScript project checks and creates `dist/`.
- `.github/workflows/build.yml` validates pull requests.
- `.github/workflows/deploy-pages.yml` builds and deploys `main` to GitHub Pages.
- `public/CNAME` declares the intended custom domain.

GitHub Pages is static hosting. It does not run Express, API routes, background jobs, Steam OpenID callbacks, payment webhooks, or privileged game-server commands.

## Planned trust boundaries

1. **Browser:** public content, UI state, Firebase Web SDK, and calls to authenticated backend endpoints. Anything shipped to the browser is public; `VITE_*` values are not secrets.
2. **Firebase Authentication / Firestore:** identity and narrowly scoped user data. Firestore rules remain deny-by-default until collection schemas and access rules are reviewed.
3. **Trusted backend (not yet provisioned):** Steam OpenID verification, Firebase Admin custom-token minting, authorization checks, payment webhook signature verification, idempotency, VIP entitlement records, and server-side game integration.
4. **Rust server:** VIP delivery must happen only after a trusted backend validates the payment provider event and records the entitlement. The browser must never issue privileged server commands or mark an order paid.

## Current implementation status

- Firebase Web SDK is initialized from the dedicated Web App config in the frontend; GitHub Actions Variables can override the public config.
- The account UI exposes Steam as the only sign-in and registration method; email/password account creation and login have been removed.
- First successful Steam OpenID login must create the Firebase identity and `users/{uid}` profile automatically; subsequent logins resolve to the same identity.
- Firestore rules allow users to read only their own profile. Profile writes are reserved for the trusted backend using Firebase Admin SDK.
- Firebase Authentication is used for Firebase Custom Token sessions, not as a direct Steam provider.
- A deployable Node.js Steam OpenID backend now lives in `backend/`. It verifies Steam assertions server-side, creates Firebase identities with stable Steam UIDs, stores owner-only profiles, and exchanges short-lived one-time codes for Firebase custom tokens. The service is not live until deployed; the button remains unavailable when `VITE_API_BASE_URL` is not configured.
- Firebase Console setup still requires creating Firestore, publishing `firestore.rules`, and authorizing `rusty-lub.online`. Do not enable Email/Password for Rusty.Lub login.
- Backend unit tests cover SteamID claim parsing and OpenID request construction. Live Steam login and Firebase session exchange still require deployment and an end-to-end test.

## Integration decisions

- Use a dedicated Firebase project for this repository; never reuse the legacy site's Firebase credentials.
- Steam authentication must be verified server-side before issuing a Firebase custom token.
- Platega payment confirmation must be verified server-side from the provider's signed/authoritative webhook. A return URL or browser callback is not proof of payment.
- VIP duration is seven days. The backend must bind the entitlement to a validated SteamID and use idempotent delivery so webhook retries cannot duplicate grants.
- Online player counts, map information, and server status must come from a real server query or trusted API. Unknown values must remain explicitly unavailable rather than fabricated.

## Configuration

### Browser-safe build variables

Copy `.env.example` to `.env.local` and fill it only with the Web App config from the new Firebase project. These values are public client configuration, not privileged credentials. Do not commit `.env.local`.

### Server-only secrets (future backend)

Keep Firebase Admin runtime identity configuration, service-account signing permissions, Steam Web API key, Platega API/webhook secrets, and Rust server RCON credentials in the backend provider's secret manager. The backend uses Google Application Default Credentials and IAM signing; do not commit service-account JSON files. Never use `VITE_` prefixes for secrets and never commit service-account JSON files.

## Repository layout

- `src/` — React application and browser integrations.
- `backend/` — standalone Node.js Steam OpenID verification and Firebase Admin service.
- `public/` — static public assets, CNAME, robots and sitemap.
- `docs/` — architecture and operational decisions.
- `firestore.rules` — deny-by-default Firestore policy until reviewed rules are implemented.
- `.github/workflows/` — pull-request validation and Pages deployment.

## Release checklist

- [ ] Pull-request build passes.
- [ ] Production Pages workflow passes.
- [ ] GitHub Pages custom domain is configured as `rusty-lub.online`.
- [ ] Registrar DNS is verified before changing apex records; do not alter the separate game-server subdomain.
- [ ] HTTPS is issued and enforced by GitHub Pages.
- [ ] Firebase project is confirmed to be the dedicated project before adding credentials.
- [ ] Backend trust boundaries and Firestore rules are reviewed before enabling account, payment, or VIP features.


## VIP Queue Pass implementation

- The account panel now contains a seven-day VIP Queue Pass shop, a server-provided price, the current entitlement state, and the user's recent payment history.
- Checkout requires an authenticated Steam Firebase session. The backend derives SteamID64 from verified custom-token claims; clients cannot select a target Steam account.
- Platega order creation, callback credential checks, authoritative transaction-status lookup, amount/currency checks, and payment-ID idempotency are implemented in the trusted backend.
- Confirmed payments create a seven-day Firestore entitlement and a durable Carbon delivery job. Renewal extends the existing expiry rather than overwriting remaining time.
- The Carbon plugin in `carbon/RustyLubVipQueue.cs` consumes leased grant/expiry jobs using a backend-only shared secret. It uses Rust's native `global.skipqueueid` and `global.removeskipqueue` commands and persists changes with `server.writecfg`.
- Price and Platega credentials are server-only environment values. Checkout remains disabled until Platega credentials, an explicitly selected VIP price, the Carbon shared secret, and a recent authenticated Carbon heartbeat are present.
- Chargebacks, partial refunds, and disputes are marked for manual review. They are not silently treated as paid orders.
- The backend and Carbon plugin still require deployment and a live test on the actual Rust/Carbon server. No payment or VIP delivery is live merely because the code exists.
