#!/usr/bin/env bash
# =============================================================================
# 03-deploy-frontend.sh
# Builds the React frontend on THIS SERVER and places it under Nginx.
# The frontend lives ON THE SAME VM as the backend — Nginx serves static files.
#
# Run on the SERVER (not locally).
# Usage: bash 03-deploy-frontend.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"
nvm use 20

# ── Locate the frontend source (cloned alongside backend) ────────────────────
# Expected layout on the server:
#   ~/apps/
#     lms-api/              ← NestJS backend
#     lms-frontend/         ← React frontend (git clone here)
FRONTEND_DIR="$HOME/apps/lms-frontend"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  info "Frontend directory not found at $FRONTEND_DIR"
  read -rp "Enter git repo URL for the frontend: " REPO_URL
  git clone "$REPO_URL" "$FRONTEND_DIR"
fi

cd "$FRONTEND_DIR"
git pull origin main 2>/dev/null || true   # update if already cloned

# ── Verify .env.production ────────────────────────────────────────────────────
ENV_FILE="$FRONTEND_DIR/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.production not found at $ENV_FILE"
  warn "Create it based on deploy/env/frontend.env — then re-run this script."

  cat <<'ENVHELP'

Required contents of .env.production:
  VITE_LMS_BASE_URL=https://lmsapi.suraksha.lk
  VITE_ENABLE_CACHE=true
  VITE_FIREBASE_API_KEY=...
  VITE_FIREBASE_AUTH_DOMAIN=suraksha-ab3c0.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=suraksha-ab3c0
  VITE_FIREBASE_STORAGE_BUCKET=suraksha-ab3c0.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID=...
  VITE_FIREBASE_APP_ID=...
  VITE_FIREBASE_VAPID_KEY=...
  VITE_SPECIAL_API_KEY=...
ENVHELP
  exit 1
fi

if grep -q "CHANGE_ME" "$ENV_FILE"; then
  die ".env.production has unfilled CHANGE_ME values. Edit $ENV_FILE first."
fi

# ── Install deps & build ──────────────────────────────────────────────────────
info "Installing dependencies..."
npm ci

info "Building (this takes ~2-3 min on a small VM)..."
# Increase memory limit for Vite build on low-RAM servers
NODE_OPTIONS="--max-old-space-size=1536" npm run build

[[ -d dist ]] || die "Build failed — dist/ not created"
info "Build complete: $(du -sh dist | cut -f1)"

# ── Backup previous deployment ────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
if [[ -d /var/www/lms && "$(ls -A /var/www/lms 2>/dev/null | head -1)" ]]; then
  cp -r /var/www/lms "/var/www/lms-backup-$TIMESTAMP"
  info "Previous build backed up to /var/www/lms-backup-$TIMESTAMP"
  # Keep only last 3 backups
  ls -dt /var/www/lms-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf
fi

# ── Copy dist to Nginx web roots ──────────────────────────────────────────────
info "Deploying to /var/www/lms/ ..."
rsync -a --delete dist/ /var/www/lms/

# Deploy same build to other subdomains
for SITE in org admin transport; do
  info "Deploying to /var/www/$SITE/ ..."
  rsync -a --delete dist/ /var/www/"$SITE"/
done

# ── Verify service worker ─────────────────────────────────────────────────────
if [[ -f /var/www/lms/firebase-messaging-sw.js ]]; then
  info "firebase-messaging-sw.js present"
else
  warn "firebase-messaging-sw.js MISSING — push notifications won't work"
  warn "Make sure it is in  $FRONTEND_DIR/public/  before building"
fi

# ── Quick smoke test ──────────────────────────────────────────────────────────
if curl -sf http://127.0.0.1/index.html -H "Host: lms.suraksha.lk" -o /dev/null; then
  info "Nginx serving index.html"
else
  warn "Nginx not responding — check 'sudo nginx -t' and 'sudo systemctl status nginx'"
fi

info "Frontend deployed. Test: https://lms.suraksha.lk"
info ""
info "Note: frontend and backend run on the SAME VM"
info "  Backend  → PM2 on port 8080, proxied via Nginx at lmsapi.suraksha.lk"
info "  Frontend → static files in /var/www/lms, served by Nginx at lms.suraksha.lk"
