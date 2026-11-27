# Contributing

## Before opening a pull request

1. Use Node.js 22 (the repository pins this in `.nvmrc`).
2. Install dependencies with `npm install`.
3. Run `npm run build` and resolve TypeScript or Vite errors.
4. Keep credentials and local environment files out of commits.
5. Describe user-visible changes and any required external configuration.

Pull requests targeting `main` are checked by GitHub Actions. Changes merged to `main` are published through the GitHub Pages workflow.

## Integration safety

Do not add browser-side implementations for Steam OpenID verification, payment verification, VIP grants, or privileged RCON operations. These require a trusted backend. See [the architecture document](docs/ARCHITECTURE.md) and [security policy](SECURITY.md).
