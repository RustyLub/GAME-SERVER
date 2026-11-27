#!/usr/bin/env bash
set -euo pipefail

FIREBASE_PROJECT_ID="$(printenv FIREBASE_PROJECT_ID || true)"
REGION="$(printenv REGION || true)"

[[ -n "$FIREBASE_PROJECT_ID" ]] || { echo "Set FIREBASE_PROJECT_ID"; exit 1; }
[[ -n "$REGION" ]] || REGION="europe-west1"
[[ "$REGION" == "europe-west1" ]] || {
  echo "firebase.auth.json currently targets europe-west1; set REGION=europe-west1."
  exit 1
}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Deploying Firebase Hosting auth proxy site rustylub-auth..."
npx --yes firebase-tools@latest deploy --config firebase.auth.json --only hosting --project "$FIREBASE_PROJECT_ID"
echo "Firebase Hosting auth proxy deployed. Verify auth.rusty-lub.online after its custom domain and TLS certificate are active."
