#!/usr/bin/env bash
# =============================================================================
# 01-server-setup.sh
# Run ONCE on a fresh Ubuntu 22.04 LTS GCP VM as ubuntu user.
# Database is Cloud SQL — this script installs the Auth Proxy, not MySQL.
# Usage:  bash 01-server-setup.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
section() { echo -e "\n${GREEN}══════════════════════════════════════════${NC}"; echo -e "${GREEN} $*${NC}"; echo -e "${GREEN}══════════════════════════════════════════${NC}\n"; }

if [[ "$EUID" -eq 0 ]]; then
  echo -e "${RED}Run as ubuntu user, not root${NC}"; exit 1
fi

# =============================================================================
# 1. System update
# =============================================================================
section "System update"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y \
  curl wget git unzip build-essential software-properties-common \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban \
  htop tmux screen \
  logrotate gnupg lsb-release ca-certificates \
  google-cloud-cli          # needed by 06-backup.sh for gcloud sql export

# =============================================================================
# 2. Mount persistent data disk (for Redis)
# =============================================================================
section "Mount data disk (Redis)"

DATA_DISK="/dev/disk/by-id/google-data-disk"
MOUNT_POINT="/data"

sudo mkdir -p "$MOUNT_POINT"

if ! sudo blkid "$DATA_DISK" &>/dev/null; then
  warn "Formatting data disk (first run only)..."
  sudo mkfs.ext4 -F "$DATA_DISK"
fi

if ! grep -q "$MOUNT_POINT" /etc/fstab; then
  echo "UUID=$(sudo blkid -s UUID -o value $DATA_DISK)  $MOUNT_POINT  ext4  defaults,nofail  0  2" \
    | sudo tee -a /etc/fstab
fi

sudo mount -a
sudo chown ubuntu:ubuntu "$MOUNT_POINT"
info "Data disk mounted at $MOUNT_POINT (Redis persistence)"

# =============================================================================
# 3. Node.js 20 via nvm
# =============================================================================
section "Node.js 20"

if [[ ! -d "$HOME/.nvm" ]]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

nvm install 20
nvm use 20
nvm alias default 20

# Make node available to sudo / systemd
NODE_BIN=$(dirname "$(nvm which current)")
if ! grep -qF "$NODE_BIN" /etc/environment; then
  sudo sed -i "s|PATH=\"|PATH=\"$NODE_BIN:|" /etc/environment
fi

info "Node $(node -v) ready"

# =============================================================================
# 4. PM2
# =============================================================================
section "PM2"

npm install -g pm2

PM2_STARTUP=$(pm2 startup systemd -u ubuntu --hp "$HOME" | grep "sudo")
eval "$PM2_STARTUP"
sudo systemctl enable pm2-ubuntu
info "PM2 startup enabled"

pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size   50M
pm2 set pm2-logrotate:retain     30
pm2 set pm2-logrotate:compress   true
pm2 set pm2-logrotate:rotateInterval "0 0 * * *"

# =============================================================================
# 5. Cloud SQL Auth Proxy (replaces self-hosted MySQL)
# =============================================================================
section "Cloud SQL Auth Proxy"

# Fetch latest release tag
PROXY_VERSION=$(curl -sf https://api.github.com/repos/GoogleCloudPlatform/cloud-sql-proxy/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4 || echo "v2.13.0")

info "Installing Cloud SQL Auth Proxy $PROXY_VERSION"
curl -fsSL \
  "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${PROXY_VERSION}/cloud-sql-proxy.linux.amd64" \
  -o /tmp/cloud-sql-proxy
chmod +x /tmp/cloud-sql-proxy
sudo mv /tmp/cloud-sql-proxy /usr/local/bin/cloud-sql-proxy
cloud-sql-proxy --version

# ── Get the Cloud SQL connection name ────────────────────────────────────────
# Format: PROJECT_ID:REGION:INSTANCE_NAME
# You can find it in Terraform output: terraform output cloudsql_connection_name
if [[ -f /etc/cloud-sql-proxy.conf ]]; then
  CLOUDSQL_CONN_NAME=$(grep CONN_NAME /etc/cloud-sql-proxy.conf | cut -d= -f2)
  info "Using existing connection name: $CLOUDSQL_CONN_NAME"
else
  read -rp "Enter Cloud SQL connection name (from: terraform output cloudsql_connection_name): " CLOUDSQL_CONN_NAME
  [[ -z "$CLOUDSQL_CONN_NAME" ]] && { echo "Connection name required"; exit 1; }
fi

sudo tee /etc/cloud-sql-proxy.conf <<PROXYCONF
CONN_NAME=$CLOUDSQL_CONN_NAME
PROXYCONF

# ── systemd service ───────────────────────────────────────────────────────────
sudo tee /etc/systemd/system/cloud-sql-proxy.service <<SVCEOF
[Unit]
Description=Cloud SQL Auth Proxy
Documentation=https://cloud.google.com/sql/docs/mysql/sql-proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
EnvironmentFile=/etc/cloud-sql-proxy.conf
ExecStart=/usr/local/bin/cloud-sql-proxy \\
  --address=127.0.0.1 \\
  --port=3306 \\
  \${CONN_NAME}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloud-sql-proxy

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable cloud-sql-proxy
sudo systemctl start cloud-sql-proxy

# Wait for proxy to be ready
for i in {1..15}; do
  if nc -z 127.0.0.1 3306 2>/dev/null; then
    info "Cloud SQL Auth Proxy is listening on 127.0.0.1:3306"
    break
  fi
  sleep 2
  [[ "$i" -eq 15 ]] && warn "Proxy not responding yet — check: sudo journalctl -u cloud-sql-proxy -n 30"
done

info "DB_HOST=127.0.0.1  DB_PORT=3306  (via Auth Proxy → Cloud SQL)"
info "Cloud SQL user credentials are set in Terraform (db_password variable)"
info "Database: suraksha_lms_db  |  User: lms_user"

# =============================================================================
# 6. Redis 7 (self-hosted, data on persistent disk)
# =============================================================================
section "Redis 7"

sudo mkdir -p /data/redis
sudo apt-get install -y redis-server

REDIS_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
echo "Redis password: $REDIS_PASS" >> ~/credentials.txt
chmod 600 ~/credentials.txt

sudo tee /etc/redis/redis.conf <<REDISCNF
# Basic
port 6379
bind 127.0.0.1
protected-mode yes
requirepass $REDIS_PASS

# Persistence on separate disk
dir /data/redis
appendonly yes
appendfilename "appendonly.aof"
aof-use-rdb-preamble yes

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Performance
tcp-keepalive 300
timeout 0

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
REDISCNF

sudo chown -R redis:redis /data/redis
sudo chown redis:redis /etc/redis/redis.conf
sudo chmod 640 /etc/redis/redis.conf

sudo tee /etc/systemd/system/redis.service.d/override.conf <<'REDISSVC'
[Service]
ReadWritePaths=/data/redis
REDISSVC

sudo systemctl daemon-reload
sudo systemctl enable redis-server
sudo systemctl restart redis-server

info "Redis running with password (saved to ~/credentials.txt)"

# =============================================================================
# 7. Nginx configuration
# =============================================================================
section "Nginx"

sudo tee /etc/nginx/conf.d/rate-limit.conf <<'RLCONF'
limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=20r/s;
limit_req_zone $binary_remote_addr zone=web_limit:10m  rate=60r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:5m  rate=5r/s;
RLCONF

sudo mkdir -p /etc/nginx/snippets

sudo tee /etc/nginx/snippets/ssl-params.conf <<'SSLCONF'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_cache shared:SSL:20m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
SSLCONF

sudo tee /etc/nginx/snippets/security-headers.conf <<'SHCONF'
add_header X-Frame-Options              "DENY" always;
add_header X-Content-Type-Options       "nosniff" always;
add_header X-XSS-Protection             "1; mode=block" always;
add_header Referrer-Policy              "strict-origin-when-cross-origin" always;
add_header Permissions-Policy           "geolocation=(), microphone=(), camera=()" always;
add_header Cross-Origin-Opener-Policy   "same-origin" always;
SHCONF

sudo mkdir -p /var/www/{lms,org,admin,transport}
sudo chown -R ubuntu:ubuntu /var/www

sudo rm -f /etc/nginx/sites-enabled/default

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NGINX_SITES="$REPO_ROOT/deploy/nginx/sites"

if [[ -d "$NGINX_SITES" ]]; then
  for conf in "$NGINX_SITES"/*.conf; do
    sudo cp "$conf" /etc/nginx/sites-available/
    name=$(basename "$conf")
    sudo ln -sf "/etc/nginx/sites-available/$name" "/etc/nginx/sites-enabled/$name"
  done
  info "Nginx site configs installed"
else
  warn "Nginx site configs not found at $NGINX_SITES — copy them manually"
fi

for SITE in lms org admin transport; do
  echo "<html><body><p>$SITE — deploying…</p></body></html>" \
    | sudo tee /var/www/"$SITE"/index.html > /dev/null
done

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl reload nginx
info "Nginx running"

# =============================================================================
# 8. UFW firewall
# =============================================================================
section "UFW firewall"

sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit  22/tcp   comment "SSH rate-limited"
sudo ufw allow  80/tcp   comment "HTTP"
sudo ufw allow  443/tcp  comment "HTTPS"
sudo ufw --force enable
sudo ufw status verbose
info "UFW enabled"

# =============================================================================
# 9. fail2ban
# =============================================================================
section "fail2ban"

sudo tee /etc/fail2ban/jail.d/lms.conf <<'F2BCONF'
[sshd]
enabled  = true
port     = ssh
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
findtime = 600

[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/*-error.log
maxretry = 5
bantime  = 3600

[nginx-limit-req]
enabled  = true
port     = http,https
filter   = nginx-limit-req
logpath  = /var/log/nginx/*-error.log
maxretry = 10
bantime  = 600

[nginx-botsearch]
enabled  = true
port     = http,https
filter   = nginx-botsearch
logpath  = /var/log/nginx/*-access.log
maxretry = 2
bantime  = 86400
F2BCONF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
info "fail2ban running"

# =============================================================================
# 10. Unattended security upgrades
# =============================================================================
section "Unattended security upgrades"

sudo apt-get install -y unattended-upgrades

sudo tee /etc/apt/apt.conf.d/50unattended-upgrades <<'UUCONF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UUCONF

sudo tee /etc/apt/apt.conf.d/20auto-upgrades <<'AUCONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUCONF

sudo systemctl enable --now unattended-upgrades
info "Unattended upgrades enabled"

# =============================================================================
# 11. SSH hardening
# =============================================================================
section "SSH hardening"

sudo tee /etc/ssh/sshd_config.d/99-lms-hardening.conf <<'SSHCONF'
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
SSHCONF

sudo systemctl restart sshd
info "SSH hardened (password auth disabled)"

# =============================================================================
# 12. Log directories and app dir
# =============================================================================
sudo mkdir -p /var/log/pm2
sudo chown ubuntu:ubuntu /var/log/pm2
mkdir -p ~/apps/lms-api

# =============================================================================
# Done
# =============================================================================
section "Setup complete!"
echo ""
info "Credentials saved to ~/credentials.txt — copy them NOW"
warn "  Redis password is in ~/credentials.txt (Cloud SQL password is in Terraform db_password)"
echo ""
warn "Next steps:"
echo "  1. Copy backend.env to ~/apps/lms-api/.env and fill all CHANGE_ME values"
echo "     — Use the Redis password from ~/credentials.txt for REDIS_PASSWORD"
echo "     — DB_HOST=127.0.0.1  DB_PORT=3306  (Auth Proxy already running)"
echo "     — DB_PASSWORD = the db_password you set in terraform.tfvars"
echo "  2. Run: bash 02-deploy-backend.sh"
echo "  3. Run: bash 03-deploy-frontend.sh"
echo "  4. Run: bash 04-ssl-setup.sh   (DNS must resolve first!)"
echo "  5. Set BACKUP_BUCKET env var for Cloud SQL exports:"
echo "     echo 'BACKUP_BUCKET=\$(terraform output -raw backup_bucket)' >> ~/apps/lms-api/.env"
echo ""
info "Cloud SQL connection name: $(cat /etc/cloud-sql-proxy.conf | grep CONN_NAME | cut -d= -f2)"
info "Proxy status: sudo systemctl status cloud-sql-proxy"
