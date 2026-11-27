#!/usr/bin/env bash
set -euo pipefail

GCP_PROJECT_ID="$(printenv GCP_PROJECT_ID || true)"
FIREBASE_PROJECT_ID="$(printenv FIREBASE_PROJECT_ID || true)"
RUNTIME_SERVICE_ACCOUNT="$(printenv RUNTIME_SERVICE_ACCOUNT || true)"
REGION="$(printenv REGION || true)"
SERVICE_NAME="$(printenv SERVICE_NAME || true)"
BACKEND_PUBLIC_URL="$(printenv BACKEND_PUBLIC_URL || true)"
DISCORD_CLIENT_ID="$(printenv DISCORD_CLIENT_ID || true)"
RCON_HOST="$(printenv RCON_HOST || true)"
RCON_PORT="$(printenv RCON_PORT || true)"
STEAM_API_KEY_SECRET_NAME="$(printenv STEAM_API_KEY_SECRET_NAME || true)"
DISCORD_CLIENT_SECRET_SECRET_NAME="$(printenv DISCORD_CLIENT_SECRET_SECRET_NAME || true)"
RCON_PASSWORD_SECRET_NAME="$(printenv RCON_PASSWORD_SECRET_NAME || true)"
PLATEGA_SECRET_SECRET_NAME="$(printenv PLATEGA_SECRET_SECRET_NAME || true)"
PLATEGA_API_BASE="$(printenv PLATEGA_API_BASE || true)"
PLATEGA_MERCHANT_ID="$(printenv PLATEGA_MERCHANT_ID || true)"
PLATEGA_PAYMENT_METHOD="$(printenv PLATEGA_PAYMENT_METHOD || true)"
VIP_PRICE_RUB="$(printenv VIP_PRICE_RUB || true)"
VIP_SCHEDULER_SERVICE_ACCOUNT="$(printenv VIP_SCHEDULER_SERVICE_ACCOUNT || true)"
LEGAL_DETAILS_COMPLETE="$(printenv LEGAL_DETAILS_COMPLETE || true)"

[[ -n "$GCP_PROJECT_ID" ]] || { echo "Set GCP_PROJECT_ID"; exit 1; }
[[ -n "$FIREBASE_PROJECT_ID" ]] || { echo "Set FIREBASE_PROJECT_ID to the dedicated GAME-SERVER Firebase project"; exit 1; }
[[ -n "$RUNTIME_SERVICE_ACCOUNT" ]] || { echo "Set RUNTIME_SERVICE_ACCOUNT"; exit 1; }
[[ -n "$REGION" ]] || REGION="europe-west1"
[[ -n "$SERVICE_NAME" ]] || SERVICE_NAME="rusty-lub-auth"

FRONTEND_ORIGIN="https://rusty-lub.online"
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
secret_bindings=()
[[ -n "$STEAM_API_KEY_SECRET_NAME" ]] && secret_bindings+=("STEAM_API_KEY=$STEAM_API_KEY_SECRET_NAME:latest")
[[ -n "$DISCORD_CLIENT_SECRET_SECRET_NAME" ]] && secret_bindings+=("DISCORD_CLIENT_SECRET=$DISCORD_CLIENT_SECRET_SECRET_NAME:latest")
[[ -n "$RCON_PASSWORD_SECRET_NAME" ]] && secret_bindings+=("RCON_PASSWORD=$RCON_PASSWORD_SECRET_NAME:latest")
[[ -n "$PLATEGA_SECRET_SECRET_NAME" ]] && secret_bindings+=("PLATEGA_SECRET=$PLATEGA_SECRET_SECRET_NAME:latest")
secret_flags=()
if (( ${#secret_bindings[@]} > 0 )); then
  secret_value="$(IFS=,; printf '%s' "${secret_bindings[*]}")"
  secret_flags=(--set-secrets "$secret_value")
fi

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
    --set-env-vars "FRONTEND_ORIGIN=$FRONTEND_ORIGIN,BACKEND_PUBLIC_URL=$backend_url,FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,FIREBASE_SERVICE_ACCOUNT_EMAIL=$RUNTIME_SERVICE_ACCOUNT,DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID,DISCORD_REDIRECT_URI=$backend_url/auth/discord/callback,RCON_HOST=$RCON_HOST,RCON_PORT=$RCON_PORT,PLATEGA_API_BASE=$PLATEGA_API_BASE,PLATEGA_MERCHANT_ID=$PLATEGA_MERCHANT_ID,PLATEGA_PAYMENT_METHOD=$PLATEGA_PAYMENT_METHOD,VIP_PRICE_RUB=$VIP_PRICE_RUB,VIP_SCHEDULER_SERVICE_ACCOUNT=$VIP_SCHEDULER_SERVICE_ACCOUNT,LEGAL_DETAILS_COMPLETE=$LEGAL_DETAILS_COMPLETE" \
    "${secret_flags[@]}"
}

echo "Deploying Rusty.Lub backend to Cloud Run..."
deploy_service "https://placeholder.invalid"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project "$GCP_PROJECT_ID" --region "$REGION" --format="value(status.url)")"
[[ "$SERVICE_URL" == https://* ]] || { echo "Cloud Run did not return an HTTPS service URL."; exit 1; }

FINAL_BACKEND_URL="$BACKEND_PUBLIC_URL"
[[ -n "$FINAL_BACKEND_URL" ]] || FINAL_BACKEND_URL="$SERVICE_URL"
[[ "$FINAL_BACKEND_URL" == https://* ]] || { echo "BACKEND_PUBLIC_URL must use HTTPS."; exit 1; }

echo "Updating callbacks to the final backend URL..."
deploy_service "$FINAL_BACKEND_URL"

echo
echo "Cloud Run service URL: $SERVICE_URL"
echo "Backend public URL: $FINAL_BACKEND_URL"
echo "Set GitHub Actions Variable VITE_API_BASE_URL to the backend public URL."
echo "All secret values must remain in Secret Manager and Cloud Run secret mappings."
