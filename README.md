# Rusty.Lub — GAME-SERVER

Bilingual public website for the Rusty.Lub Rust server network. The server catalog is driven by a shared configuration; EU Long is the network's first listed server.

- Target production domains: https://rusty-lub.online and https://rusty-lub.ru (independent access, no cross-domain redirect).
- Current live hosting: GitHub Pages serves the `.online` domain only until the dual-domain Cloudflare migration is activated.
- Repository: https://github.com/RustyLub/GAME-SERVER
- Frontend hosting: GitHub Pages interim deployment; a manual Cloudflare Pages workflow is prepared for both domains.
- Frontend: React 19 + TypeScript + Vite 8
- Trusted backend: Node.js + Firebase Admin on Google Cloud Run

## Current game server — EU Long

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

Gameplay follows the classic Vanilla x1 ruleset; community and administration integrations are kept separate from gameplay balance.

## Website features

- Russian and English route sets with language switching.
- Configuration-driven server directory with dedicated Russian/English detail routes for each listed server.
- Server connection address, Steam connect link, live status indicator and wipe schedule.
- Server, wipe, rules, support, privacy, terms, account, account-linking, store and leaderboard pages.
- Steam OpenID sign-in with server verification and Firebase Custom Tokens.
- Discord account linking through server-side OAuth2.
- Owner-scoped Firestore profile and read-only order history.
- VIP Queue Pass has a server-side Platega/RCON/Cloud Scheduler implementation for a seven-day native Rust queue-skip permission. Checkout remains disabled until merchant details, Cloud Run, RCON and Scheduler are configured and verified; no game plugin is used.
- Player leaderboard remains “Скоро” until a trusted game statistics source is connected.
- Route prerendering, sitemap, robots, canonical URLs and separate RU/EN OG artwork.

## Adding another network server

Add a new entry to the `servers` array in `src/config/site.ts` with a unique `id` and URL-safe `slug`. The catalog, server detail route, Russian/English prerendered pages, metadata and sitemap entries are generated from that list. Keep `statusAvailable: false` until the public status API has been extended to return that specific server; the current status endpoint is for EU Long only. The current wipe calculator uses the network's first-Thursday Moscow-time schedule.

## Local checks

Requirements: Node.js 24.12+ and npm for the frontend; Cloud Run backend runtime remains Node.js 22+.

- npm install
- npm run build
- npm run verify:release
- npm install --prefix backend
- npm test --prefix backend
- bash -n backend/deploy-cloud-run.sh

## Deployments

Pushes to main run `.github/workflows/deploy-pages.yml`. CI builds and verifies both domain-specific metadata variants, checks Cloudflare routing middleware, type-checks the frontend, validates backend syntax, runs backend and Firestore tests, and deploys the interim GitHub Pages `.online` endpoint. After Cloudflare project setup and GitHub secrets are ready, `.github/workflows/deploy-cloudflare-pages.yml` can be run manually to deploy the shared dual-domain project.

The static frontend and Cloud Run backend are separate deployments. Steam/Discord callbacks, Firebase Admin, Platega webhooks and privileged RCON commands never run in GitHub Pages.

## Domain

GitHub Pages accepts one configured custom domain and cannot independently serve both apex domains without redirect behavior. The final no-redirect setup uses one Cloudflare Pages project attached to both apex domains; its Pages middleware keeps canonical, Open Graph, sitemap and robots URLs on the requested hostname. The current GitHub Pages `.online` configuration is an interim endpoint only. See `docs/MANUAL_STEPS.md` for the Cloudflare migration and DNS-preservation procedure.

## Security and secrets

Root `.env.example` and `backend/.env.example` contain non-secret placeholders and sample public URLs only. Firebase Web App config and `VITE_API_BASE_URL` are public client values. Firebase Admin identity, Steam/Discord/Platega credentials and RCON password stay in Cloud Run / Google Secret Manager. Never place secrets in VITE_ variables or source control.

## Manual actions

Some steps require the project owner: supplying the original `IMG_0512.jpeg` brand asset, choosing the dedicated Firebase project, enabling Authentication and Firestore, publishing rules, configuring Google Cloud IAM/Cloud Run, creating Discord and Platega applications, enabling WebRCON, migrating both DNS zones without losing mail/game/auth records, and completing seller details for legal pages. They are listed in `docs/MANUAL_STEPS.md`.

