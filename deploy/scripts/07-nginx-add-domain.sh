#!/usr/bin/env bash
# =============================================================================
# 07-nginx-add-domain.sh
# Add a new custom institute domain (CNAME'd to lms.suraksha.lk) and issue cert.
# Usage: bash 07-nginx-add-domain.sh app.customerinstitute.com
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
[[ -z "$DOMAIN" ]] && { echo "Usage: $0 <domain>"; exit 1; }

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }

# Resolve IP check
MY_IP=$(curl -sf https://api.ipify.org)
RESOLVED=$(dig +short "$DOMAIN" A | head -1)
if [[ "$RESOLVED" != "$MY_IP" ]]; then
  echo "[WARN] $DOMAIN resolves to $RESOLVED, not $MY_IP — certbot may fail"
fi

# Create nginx config
sudo tee /etc/nginx/sites-available/"$DOMAIN".conf <<CONFEOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/nginx/snippets/ssl-params.conf;
    include /etc/nginx/snippets/security-headers.conf;
    root  /var/www/lms;
    index index.html;
    location ~* \.(js|css|woff2?|png|jpg|ico|svg|webp)$ { try_files \$uri =404; expires max; add_header Cache-Control "public, immutable"; }
    location = /firebase-messaging-sw.js { try_files \$uri =404; add_header Cache-Control "no-cache"; add_header Service-Worker-Allowed "/"; }
    location / { try_files \$uri \$uri/ /index.html; add_header Cache-Control "no-cache"; }
}
CONFEOF

sudo ln -sf /etc/nginx/sites-available/"$DOMAIN".conf \
            /etc/nginx/sites-enabled/"$DOMAIN".conf

# Issue cert
sudo certbot --nginx -d "$DOMAIN" --email admin@suraksha.lk --agree-tos --no-eff-email --non-interactive

sudo nginx -t && sudo systemctl reload nginx
info "Custom domain $DOMAIN is live"
