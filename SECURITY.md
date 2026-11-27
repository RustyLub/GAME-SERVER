# Security policy

## Reporting a vulnerability

Please report suspected security issues privately to `rusty.lub-slq@inbox.ru`. Include the affected page or component, reproduction steps, and impact. Do not publish exploit details or access other users' data while investigating.

## Security boundaries

- Never commit `.env` files, Firebase service-account JSON, private keys, payment secrets, or RCON credentials.
- Browser `VITE_*` variables are public and must never contain secrets.
- Steam identity, payment status, and VIP grants must be verified by a trusted backend.
- Firestore remains deny-by-default until collection-specific rules are implemented and tested.
- Do not treat a browser redirect, query parameter, or client-side state as proof of payment.
