#!/usr/bin/env bash
# =============================================================================
# 02-deploy-backend.sh
# Deploys / re-deploys the NestJS API. Safe to run multiple times.
# Usage: bash 02-deploy-backend.sh [git-branch]
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

APP_DIR="$HOME/apps/lms-api"
BRANCH="${1:-main}"

# ── Load nvm ──────────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"
nvm use 20

# ── Verify .env exists ────────────────────────────────────────────────────────
if [[ ! -f "$APP_DIR/.env" ]]; then
  die ".env not found at $APP_DIR/.env\nCopy deploy/env/backend.env there and fill all CHANGE_ME values first."
fi

# Check for unfilled placeholders
if grep -q "CHANGE_ME" "$APP_DIR/.env"; then
  warn ".env still has CHANGE_ME placeholders:"
  grep "CHANGE_ME" "$APP_DIR/.env" | cut -d= -f1 | sed 's/^/  /'
  read -rp "Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

# ── Clone or pull ─────────────────────────────────────────────────────────────
if [[ ! -d "$APP_DIR/.git" ]]; then
  info "Cloning repo..."
  read -rp "Enter git repo URL (SSH or HTTPS): " REPO_URL
  git clone "$REPO_URL" "$APP_DIR"
else
  info "Pulling latest ($BRANCH)..."
  cd "$APP_DIR"
  git fetch --all
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

cd "$APP_DIR"

# ── Install deps (production only) ────────────────────────────────────────────
info "Installing production dependencies..."
npm ci --omit=dev

# ── Build ─────────────────────────────────────────────────────────────────────
info "Building NestJS..."
npm run build

# Verify output
if [[ -f dist/main.js ]]; then
  ENTRY="dist/main.js"
elif [[ -f dist/src/main.js ]]; then
  ENTRY="dist/src/main.js"
  # PM2 ecosystem.config.js points to dist/main.js; patch it
  sed -i "s|dist/main.js|dist/src/main.js|g" "$APP_DIR/ecosystem.config.js" 2>/dev/null || true
else
  die "Build failed — neither dist/main.js nor dist/src/main.js found"
fi
info "Build output: $ENTRY"

# ── Copy PM2 config ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -f "$REPO_ROOT/deploy/pm2/ecosystem.config.js" ]]; then
  cp "$REPO_ROOT/deploy/pm2/ecosystem.config.js" "$APP_DIR/ecosystem.config.js"
fi

# ── Start or reload PM2 ───────────────────────────────────────────────────────
if pm2 describe lms-api &>/dev/null; then
  info "Reloading PM2 (zero-downtime)..."
  pm2 reload "$APP_DIR/ecosystem.config.js" --update-env
else
  info "Starting PM2..."
  pm2 start "$APP_DIR/ecosystem.config.js"
fi

pm2 save

# ── Health check ─────────────────────────────────────────────────────────────
info "Waiting for API to respond..."
for i in {1..30}; do
  if curl -sf http://127.0.0.1:8080/health &>/dev/null; then
    info "API is healthy"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    warn "API did not respond in 60s — check logs:"
    pm2 logs lms-api --lines 30 --nostream
    die "Deployment failed health check"
  fi
done

pm2 status
info "Backend deployed successfully"
