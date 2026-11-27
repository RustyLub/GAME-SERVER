# Rusty.Lub — GAME-SERVER

Production website for **Rusty.Lub EU Long**.

- Production domain: https://rusty-lub.online
- Repository: https://github.com/RustyLub/GAME-SERVER
- Hosting: GitHub Pages (GitHub Actions deployment)
- Frontend: React 19 + TypeScript + Vite
- Backend integrations: planned separately; GitHub Pages serves the static frontend only.

## Server configuration

| Setting | Value |
| --- | --- |
| Server | Rusty.Lub EU Long |
| Address | `202.36.95.125:26227` |
| Connect command | `client.connect 202.36.95.125:26227` |
| Region | Europe |
| Mode | Classic Vanilla x1 |
| Map | Procedural |
| Slots | 200 |
| Team limit | 12 |
| Wipe | First Thursday of each month |

Live online counts, Steam identity, map data, purchases and VIP delivery must come from verified backend/API sources. The frontend must not fabricate live server status or payment confirmations.

## Local development

Requirements: Node.js 22 (see `.nvmrc`) and npm.

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Deployment

Every push to `main` runs the GitHub Pages workflow:

1. Install dependencies.
2. Run TypeScript checks and the Vite production build.
3. Upload `dist/` as a Pages artifact.
4. Deploy the artifact to GitHub Pages.

The Vite base path is `/` because the production site uses the apex domain, not a repository subpath.

## Custom domain setup

The intended canonical host is `rusty-lub.online`. In the repository's **Settings → Pages**, set the custom domain to `rusty-lub.online` and wait for GitHub's DNS/HTTPS checks.

For the apex domain, configure the DNS records at the domain registrar:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | RustyLub.github.io |

Remove conflicting apex A/AAAA records before switching the website to GitHub Pages. Do not change unrelated records or the separate game-server subdomain. Enable **Enforce HTTPS** after GitHub issues the certificate.

## Firebase separation and security

This repository is intended to use its own second Firebase project. Do not reuse credentials from the existing Rusty.Lub website project.

- Copy only the new project's Web App configuration into local `.env` values prefixed with `VITE_FIREBASE_`.
- Never commit `.env`, service-account JSON, private keys, payment secrets or webhook secrets.
- Keep Firestore denied by default until collection-specific rules and trusted server-side access are implemented.
- Steam OpenID, Firebase Admin custom-token issuance, payment verification and VIP provisioning require a trusted backend. They cannot safely run in the browser or GitHub Pages.

See `.env.example` for the public Firebase Web App variable names.

## Current implementation boundaries

The React application contains the initial Rusty.Lub portal interface. Sections that need external data or backend actions are explicitly marked as not connected. The next implementation stages will add real integrations rather than fake counters, fake reviews, or simulated payment success.

This is an independent implementation using Rusty.Lub branding and original code. It does not reuse Rusticated source code or protected assets.

## Project documentation

- [Architecture and integration boundaries](docs/ARCHITECTURE.md)
- [Security policy](SECURITY.md)
- [Dependency updates](.github/dependabot.yml) are checked weekly by Dependabot.

Pull requests run the separate Build workflow. Production deployment is handled by the GitHub Pages workflow, avoiding duplicate production builds on every push.
