#!/usr/bin/env bash
set -euo pipefail

FIREBASE_PROJECT_ID="$(printenv FIREBASE_PROJECT_ID || true)"
GCP_PROJECT_ID="$(printenv GCP_PROJECT_ID || true)"
SERVICE_NAME="$(printenv SERVICE_NAME || true)"
REGION="$(printenv REGION || true)"

[[ -n "$FIREBASE_PROJECT_ID" ]] || { echo "Set FIREBASE_PROJECT_ID"; exit 1; }
[[ -n "$GCP_PROJECT_ID" ]] || { echo "Set GCP_PROJECT_ID"; exit 1; }
[[ "$FIREBASE_PROJECT_ID" == "$GCP_PROJECT_ID" ]] || { echo "FIREBASE_PROJECT_ID must match GCP_PROJECT_ID for the Firebase Hosting Cloud Run rewrite."; exit 1; }
[[ -n "$SERVICE_NAME" ]] || SERVICE_NAME="rusty-lub-auth"
[[ "$SERVICE_NAME" == "rusty-lub-auth" ]] || { echo "Firebase Hosting proxy is configured for SERVICE_NAME=rusty-lub-auth."; exit 1; }
[[ -n "$REGION" ]] || REGION="europe-west1"
[[ "$REGION" == "europe-west1" ]] || {
  echo "firebase.auth.json currently targets europe-west1; set REGION=europe-west1."
  exit 1
}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Deploying Firebase Hosting auth proxy site rustylub-auth..."
npx --yes firebase-tools@15.37.0 deploy --config firebase.auth.json --only hosting --project "$FIREBASE_PROJECT_ID"
echo "Firebase Hosting auth proxy deployed. Verify auth.rusty-lub.online after its custom domain and TLS certificate are active."
