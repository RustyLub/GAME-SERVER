# Security policy

## Reporting a vulnerability

Please report suspected security issues privately to rusty.lub-slq@inbox.ru. Include the affected page or component, reproduction steps, and impact. Do not publish exploit details or access other users' data while investigating.

## Security boundaries

- Never commit .env files, Firebase service-account JSON, private keys, Steam API keys or RCON credentials.
- Browser VITE_* variables are public and must never contain secrets. Firebase Web App configuration and the public backend URL are client configuration, not privileged credentials.
- Steam identity is verified server-side before a Firebase Custom Token is issued.
- Firestore permits a signed-in user to get only their own profile. Client writes, user listing and all other collection access are denied.
- Firebase Admin credentials and optional Steam API keys belong only in Cloud Run server configuration or Google Secret Manager.
- The production branch does not contain payment endpoints, Platega callbacks or Carbon integration. Payment-related drafts and earlier payment implementation are isolated in payments/platega-drafts.
- The Rust game server remains Vanilla; no plugins are deployed by this repository.
