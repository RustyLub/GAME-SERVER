# Rusty.Lub Game Server

React 19 + TypeScript + Vite portal. The current UI is inspired by the information architecture of Rusticated's server browser and store, adapted to the single Rusty.Lub EU Long server.

## Development

```bash
npm install
npm run dev
npm run build
```

## Implemented in the initial UI

- Responsive landing page and navigation
- Single Rusty.Lub EU Long server card
- Copyable Rust console connect command
- Server configuration, wipe schedule section, stats/maps placeholders
- Store and Steam-account sections marked as not yet connected
- Rules and Discord links

## Not connected yet

Live player counts and queue, Steam OpenID, player profiles and leaderboards, live wipe calendar, current map data, checkout/payment provider, and queue-priority provisioning require backend integrations and verified data sources. The interface labels these as pending rather than showing invented live data.

This is an independent implementation using Rusty.Lub branding and original code. It does not reuse Rusticated's source code or protected assets.