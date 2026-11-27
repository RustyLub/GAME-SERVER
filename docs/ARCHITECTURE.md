# Rusty.Lub GAME-SERVER — architecture

## Product boundary

This repository contains the public Rusty.Lub EU Long website. It is independent from the legacy Rusty.Lub website and must use a dedicated Firebase project. The production frontend is a static React application hosted on GitHub Pages at https://rusty-lub.online/.

The Rust game server remains strictly Vanilla. This repository's production branch does not install, deploy or require Carbon, Oxide/uMod or any game-server plugin.

## Runtime and delivery

- Node.js 22 is the development and CI runtime.
- React 19 + TypeScript + Vite build the browser application.
- npm run build runs TypeScript checks, creates dist/, and prerenders public routes.
- .github/workflows/deploy-pages.yml builds and deploys main to GitHub Pages.
- public/CNAME declares the intended custom domain.
- backend/ is a separate Node.js service intended for Google Cloud Run.

GitHub Pages is static hosting. It does not run Express, API routes, Steam OpenID callbacks, background jobs or privileged game-server commands.

## Trust boundaries

1. Browser: public content, UI state, Firebase Web SDK and calls to the public Steam auth endpoints. Every VITE_ value is public.
2. Firebase Authentication and Firestore: session identity and narrowly scoped profile reads. Browser writes are denied.
3. Trusted Cloud Run backend: Steam OpenID verification, Firebase Admin user creation, custom-token issuance and one-time token exchange.
4. Rust server: remains Vanilla. No plugin is installed or required by the website.

Payments, Platega, webhooks, VIP entitlements and payment-related legal drafts are isolated to the separate payments/platega-drafts branch and are not part of main. No payment endpoint is deployed from main.

## Current implementation status

- The React application contains Russian and English routes.
- Steam is the only intended sign-in method; email/password registration is not provided.
- Firebase Web SDK initializes only when all dedicated-project Web App variables are supplied. There is no hard-coded fallback to a potentially unrelated Firebase project.
- Firestore rules allow a signed-in user to get only their own profile. Listing users, profile writes and all other client access are denied.
- The backend verifies Steam OpenID server-to-server, creates Firebase identities with stable Steam UIDs, writes profiles through Firebase Admin and exchanges short-lived one-time codes for Firebase custom tokens.
- The backend is not live until it is deployed to Cloud Run, configured with the correct dedicated Firebase project and tested end-to-end.
- Player leaderboards remain a “Скоро” placeholder until a verified source of game statistics exists.

## Configuration and secrets

### Public browser build variables

The Firebase Web App configuration and the public backend base URL are not secrets. They may be provided as VITE_FIREBASE_* and VITE_API_BASE_URL build variables. Do not place privileged credentials in frontend variables.

### Server-only configuration

Keep Firebase Admin IAM identity, Steam Web API key (if used), and any future RCON credentials in Cloud Run environment configuration or Google Secret Manager. Do not commit service-account JSON, private keys or secret values. No payment or Carbon secrets are configured on main.

## Repository layout

- src/ — React application and browser integrations.
- backend/ — standalone Node.js Steam OpenID verification and Firebase Admin service.
- public/ — static public assets, CNAME, robots and sitemap.
- docs/ — architecture and operational decisions.
- firestore.rules — deny-by-default Firestore policy with owner-only profile get.
- .github/workflows/ — validation and Pages deployment.

## Release checklist

- [ ] Confirm the dedicated GAME-SERVER Firebase project in Firebase Console.
- [ ] Create the Firebase Web App and supply the six public configuration values.
- [ ] Create Firestore in Production mode and publish firestore.rules to that exact project.
- [ ] Add rusty-lub.online to Firebase Authentication authorized domains.
- [ ] Deploy backend/ to Cloud Run with a dedicated runtime service account and server-only configuration.
- [ ] Set VITE_API_BASE_URL to the public HTTPS Cloud Run URL as a GitHub Actions Variable.
- [ ] Verify new Steam registration, repeat login, invalid assertions, replay protection and logout.
- [ ] Verify the custom domain DNS and HTTPS certificate before declaring the site production-ready.
