# Rusty.Lub — GAME-SERVER

Bilingual public website for Rusty.Lub EU Long.

- Production domain: https://rusty-lub.online
- Repository: https://github.com/RustyLub/GAME-SERVER
- Frontend hosting: GitHub Pages via GitHub Actions
- Frontend: React 19 + TypeScript + Vite 8
- Trusted backend: Node.js + Firebase Admin on Google Cloud Run

## Game server

| Setting | Value |
| --- | --- |
| Server | Rusty.Lub EU Long |
| Address | 202.36.95.125:26227 |
| Console command | client.connect 202.36.95.125:26227 |
| Region | Europe |
| Mode | Classic Vanilla x1 |
| Map | Procedural |
| Slots | 200 |
| Team limit | 12 |
| Wipe | First Thursday of each month |

The Rust server remains strictly Vanilla. No Carbon, Oxide/uMod or other plugins are installed or required.

## Website features

- Russian and English route sets with language switching.
- Server connection address, copy action, Steam connect link, live status indicator and next wipe date.
- Server, wipe, rules, support, privacy, terms, account, account-linking, store and leaderboard pages.
- Steam OpenID sign-in with server verification and Firebase Custom Tokens.
- Discord account linking through server-side OAuth2.
- Owner-scoped Firestore profile and read-only order history.
- VIP Queue Pass checkout uses Platega and grants a seven-day native Rust queue-skip permission via server-side RCON. Cloud Scheduler removes expired permissions; no game plugin is used.
- Player leaderboard remains “Скоро” until a trusted game statistics source is connected.
- Route prerendering, sitemap, robots, canonical URLs and separate RU/EN OG artwork.

## Local checks

Requirements: Node.js 22+ and npm.

- npm install
- npm run build
- npm run verify:release
- npm install --prefix backend
- npm test --prefix backend
- bash -n backend/deploy-cloud-run.sh

## Deployments

Pushes to main run .github/workflows/deploy-pages.yml. CI installs frontend dependencies, type-checks and builds, prerenders all routes, verifies SEO/404 output, checks backend syntax and runs backend unit tests before deploying GitHub Pages.

The static frontend and Cloud Run backend are separate deployments. Steam/Discord callbacks, Firebase Admin, Platega webhooks and privileged RCON commands never run in GitHub Pages.

## Domain

The apex domain must be set manually in repository Settings → Pages. The public/CNAME file is not sufficient for a custom GitHub Actions workflow. See docs/MANUAL_STEPS.md for GitHub Pages A records, optional www CNAME, backend auth subdomain, HTTPS and redirect verification.

## Security and secrets

Root .env.example and backend/.env.example contain empty variable names only. Firebase Web App config and VITE_API_BASE_URL are public client values. Firebase Admin identity, Steam/Discord/Platega credentials and RCON password stay in Cloud Run / Google Secret Manager. Never place secrets in VITE_ variables or source control.

## Manual actions

Some steps require the project owner: choosing the dedicated Firebase project, enabling Authentication and Firestore, publishing rules, configuring Google Cloud IAM/Cloud Run, creating Discord and Platega applications, enabling WebRCON, setting REG.RU DNS and completing seller details for legal pages. They are listed in docs/MANUAL_STEPS.md.

