#!/usr/bin/env bash
# =============================================================================
# 04-ssl-setup.sh
# Issues Let's Encrypt certificates for all subdomains.
# Run on the SERVER after DNS has propagated to point all subdomains to this IP.
#
# Prerequisites:
#   - DNS A records for all 5 subdomains pointing to this server's IP
#   - Nginx is running (HTTP must be reachable for certbot ACME challenge)
#   - Ports 80 + 443 open in firewall
#
# Usage:  bash 04-ssl-setup.sh [your@email.com]
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

EMAIL="${1:-admin@suraksha.lk}"
DOMAINS=(
  "lms.suraksha.lk"
  "lmsapi.suraksha.lk"
  "org.suraksha.lk"
  "admin.suraksha.lk"
  "transport.suraksha.lk"
)

# ── Verify DNS resolves to this server ───────────────────────────────────────
MY_IP=$(curl -sf https://api.ipify.org || curl -sf https://ifconfig.me)
info "This server's public IP: $MY_IP"

FAIL=0
for DOMAIN in "${DOMAINS[@]}"; do
  RESOLVED=$(dig +short "$DOMAIN" A 2>/dev/null | head -1)
  if [[ "$RESOLVED" == "$MY_IP" ]]; then
    info "  ✓ $DOMAIN → $MY_IP"
  else
    warn "  ✗ $DOMAIN → '$RESOLVED' (expected $MY_IP)"
    FAIL=1
  fi
done

if [[ "$FAIL" -eq 1 ]]; then
  warn "Some domains don't resolve to this server yet."
  warn "Update your DNS A records, wait for propagation (up to 48h), then re-run."
  read -rp "Issue certificates anyway? (may fail) [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

# ── Remove placeholder SSL references from nginx configs ─────────────────────
# Before we have certs, nginx configs referencing /etc/letsencrypt/live/... fail.
# Temporarily serve HTTP-only for the certbot challenge.
sudo tee /etc/nginx/sites-available/lms-temp-challenge.conf <<'TMPCONF'
server {
    listen 80;
    server_name lms.suraksha.lk org.suraksha.lk admin.suraksha.lk transport.suraksha.lk;
    root /var/www/lms;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 200 "OK"; }
}
server {
    listen 80;
    server_name lmsapi.suraksha.lk;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { proxy_pass http://127.0.0.1:8080; }
}
TMPCONF

# Disable SSL configs temporarily
for conf in /etc/nginx/sites-enabled/*.conf; do
  name=$(basename "$conf")
  sudo mv "$conf" "/etc/nginx/sites-available/$name.disabled" 2>/dev/null || true
done
sudo ln -sf /etc/nginx/sites-available/lms-temp-challenge.conf \
            /etc/nginx/sites-enabled/lms-temp-challenge.conf
sudo nginx -t && sudo systemctl reload nginx

# ── Issue certificates ────────────────────────────────────────────────────────
info "Requesting certificates from Let's Encrypt..."

DOMAIN_ARGS=""
for D in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $D"
done

sudo certbot certonly \
  --webroot \
  --webroot-path /var/www/html \
  $DOMAIN_ARGS \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --cert-name lms.suraksha.lk \
  --non-interactive

info "Certificates issued"

# ── Re-enable production nginx configs ───────────────────────────────────────
sudo rm -f /etc/nginx/sites-enabled/lms-temp-challenge.conf

for conf in /etc/nginx/sites-available/*.conf; do
  name=$(basename "$conf")
  # Skip disabled files
  [[ "$name" == *".disabled" ]] && continue
  sudo ln -sf "/etc/nginx/sites-available/$name" "/etc/nginx/sites-enabled/$name"
done

sudo nginx -t && sudo systemctl reload nginx
info "Nginx reloaded with SSL"

# ── Set up auto-renewal ───────────────────────────────────────────────────────
info "Testing auto-renewal..."
sudo certbot renew --dry-run

# Systemd timer is installed by certbot automatically. Verify:
sudo systemctl status certbot.timer --no-pager || \
  echo "0 3 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" \
  | sudo tee /etc/cron.d/certbot-renew

info "SSL setup complete"
info "Certificates at: /etc/letsencrypt/live/lms.suraksha.lk/"
info "Auto-renewal: certbot.timer systemd unit"
