#!/usr/bin/env bash
set -euo pipefail

GCP_PROJECT_ID="$(printenv GCP_PROJECT_ID || true)"
FIREBASE_PROJECT_ID="$(printenv FIREBASE_PROJECT_ID || true)"
RUNTIME_SERVICE_ACCOUNT="$(printenv RUNTIME_SERVICE_ACCOUNT || true)"
REGION="$(printenv REGION || true)"
SERVICE_NAME="$(printenv SERVICE_NAME || true)"

if [[ -z "$GCP_PROJECT_ID" ]]; then echo "Set GCP_PROJECT_ID"; exit 1; fi
if [[ -z "$FIREBASE_PROJECT_ID" ]]; then echo "Set FIREBASE_PROJECT_ID to the dedicated GAME-SERVER Firebase project"; exit 1; fi
if [[ -z "$RUNTIME_SERVICE_ACCOUNT" ]]; then echo "Set RUNTIME_SERVICE_ACCOUNT"; exit 1; fi
if [[ -z "$REGION" ]]; then REGION="europe-west1"; fi
if [[ -z "$SERVICE_NAME" ]]; then SERVICE_NAME="rusty-lub-auth"; fi

FRONTEND_ORIGIN="https://rusty-lub.online"
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"

deploy_service() {
  local backend_url="$1"
  gcloud run deploy "$SERVICE_NAME" \
    --project "$GCP_PROJECT_ID" \
    --source "$BACKEND_DIR" \
    --region "$REGION" \
    --service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --max 3 \
    --timeout 30 \
    --set-env-vars "FRONTEND_ORIGIN=$FRONTEND_ORIGIN,BACKEND_PUBLIC_URL=$backend_url,FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,FIREBASE_SERVICE_ACCOUNT_EMAIL=$RUNTIME_SERVICE_ACCOUNT"
}

echo "Deploying Rusty.Lub Steam auth backend to Cloud Run..."
deploy_service "https://placeholder.invalid"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project "$GCP_PROJECT_ID" \
  --region "$REGION" \
  --format="value(status.url)")"

if [[ "$SERVICE_URL" != https://* ]]; then
  echo "Cloud Run did not return an HTTPS service URL." >&2
  exit 1
fi

echo "Updating the service with its final public callback URL..."
deploy_service "$SERVICE_URL"

echo
echo "Cloud Run service is deployed at: $SERVICE_URL"
echo "Set the GitHub Actions repository Variable VITE_API_BASE_URL to this URL."
echo "Do not put any server secret in a VITE_ variable."
