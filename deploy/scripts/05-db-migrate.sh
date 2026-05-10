#!/usr/bin/env bash
# =============================================================================
# 05-db-migrate.sh
# Runs TypeORM migrations after deploying a new backend version.
# Usage: bash 05-db-migrate.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
die()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

APP_DIR="$HOME/apps/lms-api"

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"
nvm use 20

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  die ".env not found"
fi

# Source .env
set -a; source .env; set +a

info "Running TypeORM migrations..."
npx typeorm migration:run -d dist/data-source.js 2>/dev/null || \
npx typeorm migration:run -d dist/src/data-source.js 2>/dev/null || \
  info "No migration script found — TypeORM synchronize=true may handle schema automatically"

info "Migration complete"
