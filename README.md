# Rusty.Lub — GAME-SERVER

Production website for Rusty.Lub EU Long.

- Production domain: https://rusty-lub.online
- Repository: https://github.com/RustyLub/GAME-SERVER
- Hosting: GitHub Pages (GitHub Actions deployment)
- Frontend: React 19 + TypeScript + Vite
- Steam/Discord auth backend: Node.js + Firebase Admin, intended for Google Cloud Run

## Server configuration

| Setting | Value |
| --- | --- |
| Server | Rusty.Lub EU Long |
| Address | 202.36.95.125:26227 |
| Connect command | client.connect 202.36.95.125:26227 |
| Region | Europe |
| Mode | Classic Vanilla x1 |
| Map | Procedural |
| Slots | 200 |
| Team limit | 12 |
| Wipe | First Thursday of each month |

The Rust server remains strictly Vanilla. No Carbon, Oxide/uMod or other plugins are installed or required by this project.

## Local development

Requirements: Node.js 22 (see .nvmrc) and npm.

- npm install
- npm run dev
- npm run build
- npm run preview

## Deployment

Every push to main runs the GitHub Pages workflow:
1. Install dependencies.
2. Run TypeScript checks and the Vite production build.
3. Run backend Steam-auth tests.
4. Upload dist/ as a Pages artifact.
5. Deploy the artifact to GitHub Pages.

GitHub Pages serves the static frontend only. Steam OpenID callbacks and Firebase Admin operations run in the separate backend service.

## Custom domain

The intended canonical host is rusty-lub.online. public/CNAME records the intended hostname in the repository, but this custom GitHub Actions deployment does not set the Pages custom-domain setting. Confirm rusty-lub.online manually in repository Settings → Pages, then verify registrar DNS independently. For the apex domain, GitHub Pages normally requires the four A records:
- 185.199.108.153
- 185.199.109.153
- 185.199.110.153
- 185.199.111.153

The www host may use a CNAME to RustyLub.github.io. Do not change unrelated mail records or the separate game-server subdomain. Enable Enforce HTTPS only after GitHub Pages has issued a valid certificate for the custom domain.

## Firebase and security

This repository must use a dedicated Firebase project for GAME-SERVER, separate from the legacy Rusty.Lub website project. The project ID must be confirmed before deployment; the frontend intentionally has no hard-coded Firebase fallback.

The Firebase Web App configuration is public client configuration. Provide the six VITE_FIREBASE_* values through local untracked environment or GitHub Actions Variables. The public Cloud Run base URL may be provided as VITE_API_BASE_URL. These are not secrets.

Firestore rules allow users to get only their own profile. Browser writes and all access to internal collections are denied. The trusted backend uses Firebase Admin through a dedicated Cloud Run runtime service account and IAM.

Never commit .env files, service-account JSON, private keys, Steam API keys or RCON credentials. Keep all privileged values in Cloud Run environment configuration or Google Secret Manager. Never use VITE_ variables for secrets.

See docs/FIREBASE_SETUP.md and backend/README.md.

## Authentication

The account area uses Steam OpenID verified server-side. The backend creates Firebase identities with stable Steam-based UIDs and returns a short-lived, one-time custom-token exchange code. Steam sign-in is not considered live until Cloud Run is deployed, the dedicated Firebase project is configured and end-to-end tests pass.

## Payments and VIP

Payment implementation and draft legal documents are isolated in the payments/platega-drafts branch. They are not part of main and must not be deployed or activated without explicit approval. The Rust game server remains Vanilla; a no-plugin VIP approach using Rust's native queue permissions may be evaluated separately after approval.

## Current feature boundaries

- Player leaderboard: “Скоро” until a verified game-statistics source is available.
- Discord account linking: not connected.
- Live player counts: not connected until a trusted server query is available.
- No payment is accepted by the production branch.

## Project documentation

- Architecture and integration boundaries: docs/ARCHITECTURE.md
- Firebase setup: docs/FIREBASE_SETUP.md
- Cloud Run backend setup: backend/README.md
- Security policy: SECURITY.md
