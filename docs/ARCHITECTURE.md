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
- Email/password registration, login, logout, password-reset email, account state, and editable display name are implemented in the client.
- User profile documents are stored at `users/{uid}`. Firestore rules restrict reads and writes to the authenticated owner and deny all other collections.
- Firebase Console setup is still required: enable Email/Password, create the Firestore database, publish `firestore.rules`, and authorize `rusty-lub.online`.
- Authentication and Firestore runtime behavior have not been verified against the live Firebase project until those Console steps are complete and a real test account is registered.
- Steam login is not implemented yet. It must not be simulated in the browser; it requires a trusted backend and secret storage.

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

Keep Firebase Admin credentials, Steam OpenID secrets (if any), Platega API/webhook secrets, and Rust server RCON credentials in the backend provider's secret manager. Never use `VITE_` prefixes for secrets and never commit service-account JSON files.

## Repository layout

- `src/` — React application and browser integrations.
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
