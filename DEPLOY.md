# Suraksha LMS — GCP Production Deployment Guide

## Scope

- Target: Single GCP VM (Ubuntu 22.04 LTS) + Cloud SQL MySQL 8 + Redis Cloud Labs + AWS S3
- Process manager: PM2
- Reverse proxy: Nginx
- TLS: Let's Encrypt (Certbot)
- IaC: Terraform
- Domains: `lms.suraksha.lk`, `lmsapi.suraksha.lk`, `org.suraksha.lk`, `admin.suraksha.lk`, `transport.suraksha.lk`

---

## Part 0 — Code Bugs Fixed Before Deployment

### 0.1 `ClassPaymentMatrix.tsx` — submission limit was 100, not 1 000

```diff
- const subsRes = await classPaymentsApi.getAllSubmissions(instituteId, classId, { limit: 100 });
+ const subsRes = await classPaymentsApi.getAllSubmissions(instituteId, classId, { limit: 1000 });
```

### 0.2 `ClassPaymentMatrix.tsx` — unused `useEffect` import

```diff
- import React, { useState, useEffect, useMemo, useCallback } from 'react';
+ import React, { useState, useMemo, useCallback } from 'react';
```

### 0.3 Backend `.env` — `ENCRYPTION_KEY` placeholder must be replaced

The current value `YourVerySecureEncryptionKey2024!@#$%^&*()_+SecureDataProtection` is a placeholder.
Generate a real key:

```bash
openssl rand -hex 32
```

Replace `ENCRYPTION_KEY` with the output.

### 0.4 Backend CORS — cookie domain for multi-subdomain auth

When a user authenticates at `lms.suraksha.lk` the refresh-token cookie must reach `org.suraksha.lk` as well.
Locate where `res.cookie('refreshToken', ...)` is called (typically in `auth.service.ts`) and ensure:

```typescript
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',     // required for cross-subdomain in same SameSite=None context
  domain: '.suraksha.lk', // leading dot = all subdomains
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

If `sameSite: 'none'` causes issues with some browsers, use `sameSite: 'lax'` and `domain: '.suraksha.lk'`.

### 0.5 Backend — enable strict origin mode in production

Set in `.env`:

```env
ORIGIN_STRICT_MODE=true
STRICT_ORIGIN_BLOCKING=true
BLOCK_UNKNOWN_ORIGINS=true
```

This prevents unknown origins from hitting the API. Ensure `CORS_ORIGINS` lists every legitimate frontend.

### 0.6 Frontend — `firebase-messaging-sw.js` service worker scope

The service worker **must** be served from the root path of each subdomain. Since Nginx will serve the same `dist/` at multiple virtual hosts, this is automatic as long as the file stays in `public/`.

### 0.7 Secrets in `cloudbuild.yaml`

All plaintext secrets must be moved to **Google Secret Manager** before pushing the repo. See Part 3.

---

## Part 1 — Architecture

```
Internet
    │  443 / 80
    ▼
[ GCP VM — Ubuntu 22.04 ]
    Nginx (TLS termination)
    ├── lms.suraksha.lk       → static /var/www/lms/dist
    ├── org.suraksha.lk       → static /var/www/org/dist (or same dist)
    ├── admin.suraksha.lk     → static /var/www/admin/dist
    ├── transport.suraksha.lk → static /var/www/transport/dist
    └── lmsapi.suraksha.lk    → proxy 127.0.0.1:8080  (PM2 — NestJS)
    │
    ├── Cloud SQL (MySQL 8.0)  — private IP / Cloud SQL Auth Proxy
    ├── Redis Cloud Labs        — external TCP
    └── AWS S3                  — external HTTPS
```

---

## Part 2 — Terraform Infrastructure

### 2.1 Directory layout

```
infra/
  main.tf
  variables.tf
  outputs.tf
  terraform.tfvars        ← never commit (in .gitignore)
  modules/
    network/main.tf
    compute/main.tf
    secrets/main.tf
    dns/main.tf
```

### 2.2 `infra/variables.tf`

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"   # Singapore — close to Sri Lanka
}

variable "zone" {
  type    = string
  default = "asia-southeast1-a"
}

variable "machine_type" {
  type    = string
  default = "e2-standard-2"   # 2 vCPU, 8 GB — adjust as needed
}

variable "disk_size_gb" {
  type    = number
  default = 50
}

variable "ssh_public_key_path" {
  description = "Path to your SSH public key"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "admin_cidr" {
  description = "Your static IP in CIDR notation for SSH access"
  type        = string
  # e.g. "203.0.113.10/32"
}

variable "domain_zone_dns_name" {
  description = "Cloud DNS zone DNS name (e.g. suraksha-lk.)"
  type        = string
  default     = "suraksha-lk."
}
```

### 2.3 `infra/terraform.tfvars` (create this file, never commit it)

```hcl
project_id           = "your-gcp-project-id"
region               = "asia-southeast1"
zone                 = "asia-southeast1-a"
admin_cidr           = "YOUR_HOME_IP/32"
ssh_public_key_path  = "~/.ssh/id_rsa.pub"
```

### 2.4 `infra/modules/network/main.tf`

```hcl
resource "google_compute_network" "lms_vpc" {
  name                    = "lms-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "lms_subnet" {
  name          = "lms-subnet"
  region        = var.region
  network       = google_compute_network.lms_vpc.id
  ip_cidr_range = "10.10.0.0/24"
}

# Allow HTTP/HTTPS from anywhere
resource "google_compute_firewall" "allow_web" {
  name    = "lms-allow-web"
  network = google_compute_network.lms_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["lms-server"]
}

# Allow SSH only from admin IP
resource "google_compute_firewall" "allow_ssh" {
  name    = "lms-allow-ssh"
  network = google_compute_network.lms_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  source_ranges = [var.admin_cidr]
  target_tags   = ["lms-server"]
}

# Block all other ingress
resource "google_compute_firewall" "deny_all_ingress" {
  name      = "lms-deny-all-ingress"
  network   = google_compute_network.lms_vpc.name
  direction = "INGRESS"
  priority  = 65534

  deny { protocol = "all" }
  source_ranges = ["0.0.0.0/0"]
}

output "network_id"  { value = google_compute_network.lms_vpc.id }
output "subnet_id"   { value = google_compute_subnetwork.lms_subnet.id }
```

### 2.5 `infra/modules/compute/main.tf`

```hcl
resource "google_compute_address" "lms_static_ip" {
  name   = "lms-static-ip"
  region = var.region
}

data "google_compute_image" "ubuntu_22" {
  family  = "ubuntu-2204-lts"
  project = "ubuntu-os-cloud"
}

resource "google_service_account" "lms_sa" {
  account_id   = "lms-server-sa"
  display_name = "LMS Server Service Account"
}

resource "google_project_iam_member" "lms_sa_secretmanager" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.lms_sa.email}"
}

resource "google_project_iam_member" "lms_sa_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.lms_sa.email}"
}

resource "google_project_iam_member" "lms_sa_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.lms_sa.email}"
}

resource "google_compute_instance" "lms_server" {
  name         = "lms-server"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["lms-server"]

  boot_disk {
    initialize_params {
      image = data.google_compute_image.ubuntu_22.self_link
      size  = var.disk_size_gb
      type  = "pd-ssd"
    }
  }

  network_interface {
    subnetwork = var.subnet_id
    access_config {
      nat_ip = google_compute_address.lms_static_ip.address
    }
  }

  service_account {
    email  = google_service_account.lms_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    ssh-keys               = "ubuntu:${file(var.ssh_public_key_path)}"
    enable-oslogin         = "false"
    serial-port-enable     = "false"
    block-project-ssh-keys = "true"
  }

  # Shielded VM — protects against rootkit/bootkit
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  scheduling {
    on_host_maintenance = "MIGRATE"
    automatic_restart   = true
  }

  labels = {
    env  = "production"
    app  = "lms"
  }
}

output "instance_ip"       { value = google_compute_address.lms_static_ip.address }
output "instance_name"     { value = google_compute_instance.lms_server.name }
output "service_account"   { value = google_service_account.lms_sa.email }
```

### 2.6 `infra/modules/secrets/main.tf`

```hcl
locals {
  secrets = [
    "DB_PASSWORD",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "BCRYPT_PEPPER",
    "ENCRYPTION_KEY",
    "DRIVE_TOKEN_ENCRYPTION_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "REDIS_PASSWORD",
    "FIREBASE_PRIVATE_KEY",
    "GOOGLE_CLIENT_SECRET",
    "WHATSAPP_ACCESS_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "SPECIAL_API_KEY",
    "SMSLENZ_API_KEY",
  ]
}

resource "google_secret_manager_secret" "lms_secrets" {
  for_each  = toset(local.secrets)
  secret_id = "lms-${lower(replace(each.key, "_", "-"))}"

  replication {
    auto {}
  }
}

# After apply, populate each secret:
# gcloud secrets versions add lms-db-password --data-file=- <<< "YOUR_PASSWORD"
```

### 2.7 `infra/modules/dns/main.tf`

```hcl
resource "google_dns_managed_zone" "lms_zone" {
  name        = "suraksha-lk"
  dns_name    = "suraksha.lk."
  description = "Suraksha LMS DNS zone"
  dnssec_config {
    state = "on"
  }
}

locals {
  subdomains = ["lms", "lmsapi", "org", "admin", "transport"]
}

resource "google_dns_record_set" "lms_a_records" {
  for_each = toset(local.subdomains)

  name         = "${each.key}.suraksha.lk."
  managed_zone = google_dns_managed_zone.lms_zone.name
  type         = "A"
  ttl          = 300
  rrdatas      = [var.server_ip]
}

output "name_servers" {
  value = google_dns_managed_zone.lms_zone.name_servers
}
```

### 2.8 `infra/main.tf`

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Store state remotely (recommended)
  backend "gcs" {
    bucket = "YOUR-PROJECT-terraform-state"
    prefix = "lms/prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "secretmanager.googleapis.com",
    "dns.googleapis.com",
    "sqladmin.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

module "network" {
  source     = "./modules/network"
  region     = var.region
  admin_cidr = var.admin_cidr
}

module "compute" {
  source              = "./modules/compute"
  project_id          = var.project_id
  region              = var.region
  zone                = var.zone
  machine_type        = var.machine_type
  disk_size_gb        = var.disk_size_gb
  subnet_id           = module.network.subnet_id
  ssh_public_key_path = var.ssh_public_key_path
}

module "secrets" {
  source = "./modules/secrets"
}

module "dns" {
  source     = "./modules/dns"
  server_ip  = module.compute.instance_ip
}
```

### 2.9 `infra/outputs.tf`

```hcl
output "server_ip"       { value = module.compute.instance_ip }
output "name_servers"    { value = module.dns.name_servers }
output "ssh_command"     { value = "ssh ubuntu@${module.compute.instance_ip}" }
```

---

## Part 3 — Secrets Population (one-time)

After `terraform apply`, populate every secret. Run from your local machine with `gcloud` authenticated:

```bash
# Syntax: gcloud secrets versions add SECRET_NAME --data-file=-
# Then paste value, then Ctrl+D

gcloud secrets versions add lms-db-password           --data-file=- <<< 'ACTUAL_DB_PASSWORD'
gcloud secrets versions add lms-jwt-secret            --data-file=- <<< 'ACTUAL_JWT_SECRET'
gcloud secrets versions add lms-jwt-refresh-secret    --data-file=- <<< 'ACTUAL_JWT_REFRESH_SECRET'
gcloud secrets versions add lms-bcrypt-pepper         --data-file=- <<< 'ACTUAL_PEPPER'
gcloud secrets versions add lms-encryption-key        --data-file=- <<< "$(openssl rand -hex 32)"
gcloud secrets versions add lms-drive-token-encryption-key --data-file=- <<< 'ACTUAL_DRIVE_KEY'
gcloud secrets versions add lms-aws-access-key-id     --data-file=- <<< 'ACTUAL_AWS_KEY'
gcloud secrets versions add lms-aws-secret-access-key --data-file=- <<< 'ACTUAL_AWS_SECRET'
gcloud secrets versions add lms-redis-password        --data-file=- <<< 'ACTUAL_REDIS_PASS'
gcloud secrets versions add lms-google-client-secret  --data-file=- <<< 'ACTUAL_GOOGLE_SECRET'
gcloud secrets versions add lms-whatsapp-access-token --data-file=- <<< 'ACTUAL_WHATSAPP_TOKEN'
gcloud secrets versions add lms-telegram-bot-token    --data-file=- <<< 'ACTUAL_TELEGRAM_TOKEN'
gcloud secrets versions add lms-special-api-key       --data-file=- <<< 'ACTUAL_SPECIAL_KEY'
gcloud secrets versions add lms-smslenz-api-key       --data-file=- <<< 'ACTUAL_SMSLENZ_KEY'

# Firebase private key (multi-line PEM) — pipe from file
gcloud secrets versions add lms-firebase-private-key  --data-file=firebase-private-key.pem
```

---

## Part 4 — Server Bootstrap

SSH into the VM after Terraform provisions it.

### 4.1 System update and base packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  curl wget git unzip \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban \
  htop tmux \
  build-essential
```

### 4.2 Node.js 20 via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node -v   # should print v20.x.x
npm -v
```

### 4.3 PM2

```bash
npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Run the output command (it will look like: sudo env PATH=... pm2 startup ...)
sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v20.x.x/bin \
  /home/ubuntu/.nvm/versions/node/v20.x.x/lib/node_modules/pm2/bin/pm2 \
  startup systemd -u ubuntu --hp /home/ubuntu
sudo systemctl enable pm2-ubuntu
```

### 4.4 Google Cloud SQL Auth Proxy (connects to Cloud SQL without exposing DB port)

```bash
curl -o cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/

# Create systemd unit
sudo tee /etc/systemd/system/cloud-sql-proxy.service <<'EOF'
[Unit]
Description=Google Cloud SQL Auth Proxy
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/local/bin/cloud-sql-proxy \
  --port 3306 \
  YOUR_PROJECT_ID:asia-southeast1:lms-db
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloud-sql-proxy
sudo systemctl start cloud-sql-proxy
```

> Replace `YOUR_PROJECT_ID:asia-southeast1:lms-db` with your actual Cloud SQL connection name.
> Find it: `gcloud sql instances describe lms-db --format='value(connectionName)'`

---

## Part 5 — Application Deployment

### 5.1 Directory structure on the server

```bash
sudo mkdir -p /var/www/{lms,org,admin,transport}
sudo chown -R ubuntu:ubuntu /var/www
mkdir -p ~/apps/lms-api
```

### 5.2 Backend deployment

```bash
cd ~/apps/lms-api

# Option A: git clone
git clone git@github.com:YOUR_ORG/lms-api-suraksha-lk.git .

# Option B: scp from local
# scp -r ./lms-api-suraksha-lk ubuntu@SERVER_IP:~/apps/lms-api

npm install --omit=dev
npm run build     # produces dist/

# Verify build
ls dist/main.js || ls dist/src/main.js
```

### 5.3 Backend `.env` — pull secrets from Secret Manager

Create a helper script `~/apps/lms-api/scripts/fetch-secrets.sh`:

```bash
#!/bin/bash
# Fetches secrets from GCP Secret Manager and writes .env
set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)

fetch() {
  gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID" 2>/dev/null || echo ""
}

cat > ~/apps/lms-api/.env <<EOF
NODE_ENV=production
PORT=8080
TZ=Asia/Colombo
LOG_LEVEL=info
LOG_FORMAT=json

# Database (via Cloud SQL Auth Proxy on 127.0.0.1:3306)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=lms_user
DB_DATABASE=suraksha-lms-db
DB_PASSWORD=$(fetch lms-db-password)

# JWT
JWT_SECRET=$(fetch lms-jwt-secret)
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=$(fetch lms-jwt-refresh-secret)
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_SALT_ROUNDS=12
BCRYPT_PEPPER=$(fetch lms-bcrypt-pepper)
ENCRYPTION_KEY=$(fetch lms-encryption-key)
DRIVE_TOKEN_ENCRYPTION_KEY=$(fetch lms-drive-token-encryption-key)

# CORS
CORS_ORIGINS=https://lms.suraksha.lk,https://org.suraksha.lk,https://admin.suraksha.lk,https://transport.suraksha.lk
ORIGIN_STRICT_MODE=true
STRICT_ORIGIN_BLOCKING=true
BLOCK_UNKNOWN_ORIGINS=true

# FRONTEND URLs
FRONTEND_URL=https://lms.suraksha.lk
ADMIN_FRONTEND_URL=https://admin.suraksha.lk
FRONTEND_PROFILE_URL=https://lms.suraksha.lk/profile

# Storage
STORAGE_PROVIDER=aws
AWS_REGION=us-east-1
AWS_S3_BUCKET=suraksha-lms-main-bucket
AWS_S3_BASE_URL=https://storage.suraksha.lk
AWS_ACCESS_KEY_ID=$(fetch lms-aws-access-key-id)
AWS_SECRET_ACCESS_KEY=$(fetch lms-aws-secret-access-key)

# Redis
REDIS_HOST=redis-14461.c10.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=14461
REDIS_USERNAME=LMS-Cash
REDIS_PASSWORD=$(fetch lms-redis-password)
CACHE_ENABLED=true

# FCM
ENABLE_FCM_NOTIFICATIONS=true
FIREBASE_PROJECT_ID=suraksha-ab3c0
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@suraksha-ab3c0.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="$(fetch lms-firebase-private-key | sed 's/\\n/\n/g')"

# Google OAuth
GOOGLE_CLIENT_ID=696735498700-vifcskk15iiq8731ic53fm2ukfo7g3av.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=$(fetch lms-google-client-secret)
GOOGLE_REDIRECT_URI=https://lmsapi.suraksha.lk/auth/google/callback
GOOGLE_DRIVE_CALLBACK_URI=https://lmsapi.suraksha.lk/drive-access/callback
GOOGLE_INSTITUTE_DRIVE_CALLBACK_URI=https://lmsapi.suraksha.lk/institute-drive/callback

# Notifications
ENABLE_WHATSAPP_NOTIFICATIONS=true
WHATSAPP_PHONE_NUMBER_ID=783996714804279
WHATSAPP_BUSINESS_ACCOUNT_ID=1123064000016125
WHATSAPP_ACCESS_TOKEN=$(fetch lms-whatsapp-access-token)
ENABLE_TELEGRAM_NOTIFICATIONS=true
TELEGRAM_BOT_TOKEN=$(fetch lms-telegram-bot-token)

# SMS
SMS_PROVIDER=smslenz
SMSLENZ_USER_ID=580
SMSLENZ_SENDER_ID=SurakshaLMS
SMSLENZ_API_KEY=$(fetch lms-smslenz-api-key)

# API Keys
SPECIAL_API_KEY=$(fetch lms-special-api-key)
WEBHOOK_VERIFY_TOKEN=laas_webhook_verify_token_2025

# Security Layers
JWT_AUTHENTICATION_LAYER_ACTIVE=true
GLOBAL_USER_TYPE_VALIDATION_LAYER_ACTIVE=true
INSTITUTE_ACCESS_VALIDATION_LAYER_ACTIVE=true
CORS_VALIDATION_LAYER_ACTIVE=true
RATE_LIMITING_LAYER_ACTIVE=true
SESSION_MANAGEMENT_LAYER_ACTIVE=true
ADMIN_ACCESS_CONTROL_LAYER_ACTIVE=true

# Admin
IS_ENABLED_ADMIN=true
ALLOWED_ADMIN_ORIGINS=https://admin.suraksha.lk
ADMIN_SESSION_TIMEOUT_MINUTES=30
ALLOWED_ADMIN_IPS=127.0.0.1,::1

# Data Masking
IS_PHONENUMBERS_MASKED=true
IS_EMAILS_MASKED=true
EOF

chmod 600 ~/apps/lms-api/.env
echo ".env written successfully"
```

```bash
chmod +x ~/apps/lms-api/scripts/fetch-secrets.sh
~/apps/lms-api/scripts/fetch-secrets.sh
```

### 5.4 PM2 Ecosystem config

Create `~/apps/lms-api/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'lms-api',
      script: 'dist/main.js',   // falls back to dist/src/main.js if not found
      cwd: '/home/ubuntu/apps/lms-api',
      instances: 'max',          // use all CPU cores
      exec_mode: 'cluster',
      env_file: '/home/ubuntu/apps/lms-api/.env',
      max_memory_restart: '1500M',
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: true,
      // Logging
      out_file: '/var/log/pm2/lms-api-out.log',
      error_file: '/var/log/pm2/lms-api-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Auto-restart on crash
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      exp_backoff_restart_delay: 100,
      // Monitoring
      pmx: false,  // disable PM2 Plus if not subscribed
    },
  ],
};
```

```bash
sudo mkdir -p /var/log/pm2
sudo chown ubuntu:ubuntu /var/log/pm2

# Start the API
pm2 start ~/apps/lms-api/ecosystem.config.js
pm2 save      # persist to startup

# Verify
pm2 status
pm2 logs lms-api --lines 50
```

### 5.5 Frontend build

Build **on your local machine** (or CI) with the correct environment:

```bash
# Frontend build — lms.suraksha.lk (main student portal)
cd "lms user frotend"

cat > .env.production <<'EOF'
VITE_LMS_BASE_URL=https://lmsapi.suraksha.lk
VITE_ENABLE_CACHE=true
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=suraksha-ab3c0.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=suraksha-ab3c0
VITE_FIREBASE_STORAGE_BUCKET=suraksha-ab3c0.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY
VITE_SPECIAL_API_KEY=YOUR_SPECIAL_API_KEY
EOF

npm run build
# Output: dist/
```

Upload to server:

```bash
rsync -avz --delete dist/ ubuntu@SERVER_IP:/var/www/lms/
# Repeat for org, admin, transport if they share the same build
rsync -avz --delete dist/ ubuntu@SERVER_IP:/var/www/org/
rsync -avz --delete dist/ ubuntu@SERVER_IP:/var/www/admin/
rsync -avz --delete dist/ ubuntu@SERVER_IP:/var/www/transport/
```

---

## Part 6 — Nginx Configuration

### 6.1 Remove default site

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 6.2 Shared SSL parameters — `/etc/nginx/snippets/ssl-params.conf`

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### 6.3 Shared security headers — `/etc/nginx/snippets/security-headers.conf`

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.google.com https://*.googleapis.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https://lmsapi.suraksha.lk wss://lmsapi.suraksha.lk https://*.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://*.gstatic.com https://*.googleapis.com; frame-src 'self' https://*.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```

### 6.4 API backend — `/etc/nginx/sites-available/lmsapi.suraksha.lk`

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name lmsapi.suraksha.lk;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lmsapi.suraksha.lk;

    ssl_certificate     /etc/letsencrypt/live/lmsapi.suraksha.lk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lmsapi.suraksha.lk/privkey.pem;
    include             /etc/nginx/snippets/ssl-params.conf;

    # API-specific security headers (no CSP on API)
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/lmsapi-access.log;
    error_log  /var/log/nginx/lmsapi-error.log;

    # Size limits
    client_max_body_size 15M;

    # Timeouts for long-running requests
    proxy_connect_timeout    60s;
    proxy_read_timeout       120s;
    proxy_send_timeout       120s;

    # Gzip
    gzip on;
    gzip_types application/json application/javascript text/plain text/css;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";  # WebSocket support
        proxy_buffering    off;                          # required for SSE/streaming
    }

    # Health check — no auth required
    location = /health {
        proxy_pass http://127.0.0.1:8080/health;
        proxy_read_timeout 5s;
        access_log off;
    }
}
```

### 6.5 Frontend sites template — repeat for each subdomain

Create `/etc/nginx/sites-available/lms.suraksha.lk`:

```nginx
server {
    listen 80;
    server_name lms.suraksha.lk;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lms.suraksha.lk;

    ssl_certificate     /etc/letsencrypt/live/lms.suraksha.lk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lms.suraksha.lk/privkey.pem;
    include             /etc/nginx/snippets/ssl-params.conf;
    include             /etc/nginx/snippets/security-headers.conf;

    root  /var/www/lms;
    index index.html;

    access_log /var/log/nginx/lms-access.log;
    error_log  /var/log/nginx/lms-error.log;

    # Gzip static assets
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Hashed assets — cache forever
    location ~* \.(js|css|woff2?|ttf|eot|otf|svg|png|jpg|jpeg|gif|ico|webp)$ {
        try_files $uri =404;
        expires max;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Service worker — must NOT be cached
    location = /firebase-messaging-sw.js {
        try_files $uri =404;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        add_header Service-Worker-Allowed "/";
    }

    # robots.txt
    location = /robots.txt {
        try_files $uri =404;
        access_log off;
    }

    # SPA fallback — all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

Copy the pattern for `org.suraksha.lk`, `admin.suraksha.lk`, `transport.suraksha.lk` — change `server_name`, `ssl_certificate` paths, `root`, and `access_log`/`error_log` paths.

### 6.6 Enable all sites

```bash
# Enable each site
for SITE in lmsapi.suraksha.lk lms.suraksha.lk org.suraksha.lk admin.suraksha.lk transport.suraksha.lk; do
  sudo ln -sf /etc/nginx/sites-available/$SITE /etc/nginx/sites-enabled/$SITE
done

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## Part 7 — SSL Certificates (Let's Encrypt)

### 7.1 Obtain certificates for all subdomains

DNS must already be pointing to your server IP before running certbot.

```bash
sudo certbot --nginx \
  -d lms.suraksha.lk \
  -d lmsapi.suraksha.lk \
  -d org.suraksha.lk \
  -d admin.suraksha.lk \
  -d transport.suraksha.lk \
  --email admin@suraksha.lk \
  --agree-tos \
  --no-eff-email \
  --redirect \
  --hsts \
  --staple-ocsp
```

> Certbot will auto-edit your nginx configs to add SSL certificate paths and HTTP → HTTPS redirects.
> After this command your `/etc/nginx/snippets/ssl-params.conf` include takes full effect.

### 7.2 Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot installs a systemd timer automatically; verify:
sudo systemctl status certbot.timer

# If not present, create a cron job:
echo "0 3 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" \
  | sudo tee /etc/cron.d/certbot
```

---

## Part 8 — Firewall (UFW)

```bash
# Reset to defaults
sudo ufw --force reset

# Allow SSH (limit brute force)
sudo ufw limit 22/tcp comment "SSH rate-limited"

# Allow web traffic
sudo ufw allow 80/tcp  comment "HTTP (redirects to HTTPS)"
sudo ufw allow 443/tcp comment "HTTPS"

# Deny everything else
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable
sudo ufw --force enable
sudo ufw status verbose
```

---

## Part 9 — fail2ban

```bash
# Already installed. Create LMS-specific jails:
sudo tee /etc/fail2ban/jail.d/lms.conf <<'EOF'
[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/*-error.log
maxretry = 5
bantime  = 3600

[nginx-badbots]
enabled  = true
port     = http,https
filter   = nginx-badbots
logpath  = /var/log/nginx/*-access.log
maxretry = 2
bantime  = 86400

[nginx-req-limit]
enabled  = true
port     = http,https
filter   = nginx-req-limit
logpath  = /var/log/nginx/*-error.log
maxretry = 10
bantime  = 600

[sshd]
enabled  = true
port     = ssh
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
EOF

sudo systemctl restart fail2ban
sudo fail2ban-client status
```

---

## Part 10 — unattended-upgrades (auto security patches)

```bash
sudo apt install -y unattended-upgrades
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

sudo tee /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

sudo systemctl enable --now unattended-upgrades
```

---

## Part 11 — PM2 Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval "0 0 * * *"   # daily at midnight
pm2 save
```

---

## Part 12 — DNS Configuration

After running `terraform apply` for the DNS module, point your domain registrar's nameservers to GCP Cloud DNS:

```bash
terraform output name_servers
# Outputs 4 nameservers like:
# ns-cloud-e1.googledomains.com.
# ns-cloud-e2.googledomains.com.
# ns-cloud-e3.googledomains.com.
# ns-cloud-e4.googledomains.com.
```

Log into your domain registrar (e.g., GoDaddy, Namecheap) and update the NS records for `suraksha.lk` to these four nameservers.

Propagation: up to 48 hours. Verify:
```bash
dig +short NS suraksha.lk
dig +short A lms.suraksha.lk
dig +short A lmsapi.suraksha.lk
```

---

## Part 13 — Step-by-Step Deployment Sequence

Run these commands in this exact order:

```bash
# 1. Provision infrastructure
cd infra
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
# Note: SERVER_IP from output

# 2. Populate secrets (one-time)
# (run the gcloud secrets commands from Part 3)

# 3. Update DNS at your registrar (nameservers from terraform output)

# 4. SSH into server
ssh ubuntu@SERVER_IP

# 5. Bootstrap server
sudo apt update && sudo apt upgrade -y
# (run Part 4 commands)

# 6. Deploy backend
cd ~/apps/lms-api
# git clone or scp your code
npm install --omit=dev && npm run build
~/apps/lms-api/scripts/fetch-secrets.sh   # writes .env
pm2 start ecosystem.config.js
pm2 save

# 7. Deploy frontend
# (build locally, rsync to /var/www/lms/ etc.)

# 8. Configure nginx
# (create /etc/nginx/snippets/ files and /etc/nginx/sites-available/ files)
sudo nginx -t && sudo systemctl reload nginx

# 9. Issue SSL certificates (DNS must resolve first)
sudo certbot --nginx -d lms.suraksha.lk -d lmsapi.suraksha.lk \
  -d org.suraksha.lk -d admin.suraksha.lk -d transport.suraksha.lk \
  --email admin@suraksha.lk --agree-tos --no-eff-email --redirect

# 10. Harden server
sudo ufw enable
sudo systemctl restart fail2ban
sudo systemctl enable unattended-upgrades

# 11. Verify
curl -I https://lmsapi.suraksha.lk/health
curl -I https://lms.suraksha.lk
pm2 status
```

---

## Part 14 — CI/CD Deployment Script

Save as `.github/workflows/deploy.yml` (GitHub Actions) or adapt for GitLab CI:

```yaml
name: Deploy to GCP

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'lms user frotend/package-lock.json'

      - name: Build frontend
        working-directory: 'lms user frotend'
        env:
          VITE_LMS_BASE_URL: https://lmsapi.suraksha.lk
          VITE_ENABLE_CACHE: 'true'
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: suraksha-ab3c0.firebaseapp.com
          VITE_FIREBASE_PROJECT_ID: suraksha-ab3c0
          VITE_FIREBASE_STORAGE_BUCKET: suraksha-ab3c0.appspot.com
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_VAPID_KEY: ${{ secrets.VITE_FIREBASE_VAPID_KEY }}
          VITE_SPECIAL_API_KEY: ${{ secrets.VITE_SPECIAL_API_KEY }}
        run: npm ci && npm run build

      - name: Build backend
        working-directory: lms-api-suraksha-lk
        run: npm ci && npm run build

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ubuntu
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            # Backend
            cd ~/apps/lms-api
            git pull origin main
            npm install --omit=dev
            npm run build
            ~/apps/lms-api/scripts/fetch-secrets.sh
            pm2 reload lms-api --update-env
            # Wait for ready
            sleep 5
            pm2 status

      - name: Deploy frontend
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ubuntu
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: 'lms user frotend/dist/*'
          target: '/var/www/lms'
          strip_components: 2
```

---

## Part 15 — Monitoring

### 15.1 PM2 status dashboard

```bash
pm2 monit        # real-time dashboard
pm2 logs         # tail all logs
pm2 logs lms-api # tail API logs only
```

### 15.2 Nginx access log monitoring

```bash
# Real-time requests
sudo tail -f /var/log/nginx/lmsapi-access.log | awk '{print $1, $7, $9}'

# Top IP addresses
sudo awk '{print $1}' /var/log/nginx/lmsapi-access.log | sort | uniq -c | sort -rn | head 20

# 5xx errors in last hour
sudo awk -v t=$(date -d "1 hour ago" +%s) \
  'match($4, /\[([^:]+):([0-9:]+)/, a) && mktime(a[1]" "a[2]) > t && $9 ~ /^5/' \
  /var/log/nginx/lmsapi-access.log | wc -l
```

### 15.3 GCP Cloud Monitoring agent (optional)

```bash
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
sudo systemctl enable --now google-cloud-ops-agent
```

---

## Part 16 — Custom Domain Support for Institute Tenants

The backend already has dynamic CORS validation that queries the database for custom domains (cached 5 min). To add a new custom domain for an institute:

1. Institute adds their domain in the admin panel → stored in `institute_custom_domains` table
2. Owner adds a CNAME DNS record: `app.theirdomain.com CNAME lms.suraksha.lk`
3. Add Nginx server_name to the LMS frontend virtual host

For automated certificate issuance per custom domain, add a wildcard certbot expansion:

```bash
# Example: add app.customerinstitute.lk
sudo certbot --nginx -d app.customerinstitute.lk --expand \
  --cert-name lms.suraksha.lk   # append to existing cert
sudo systemctl reload nginx
```

For large-scale multi-tenant custom domains, migrate to **acme.sh with DNS-01 challenge** or use **Caddy** (auto-HTTPS) instead of nginx + certbot.

---

## Part 17 — Security Checklist

| Item | Status | Action |
|------|--------|--------|
| All secrets in Secret Manager | ✅ Done | Part 3 |
| `.env` never committed | ✅ | Add to `.gitignore` |
| `ENCRYPTION_KEY` regenerated | ⚠️ Required | `openssl rand -hex 32` |
| CORS strict mode on | ✅ | Set in `.env` |
| Cookie domain `.suraksha.lk` | ✅ | Code fix in Part 0.4 |
| SSH key-only auth | Required | `PasswordAuthentication no` in `/etc/ssh/sshd_config` |
| UFW firewall | ✅ | Part 8 |
| fail2ban | ✅ | Part 9 |
| Unattended upgrades | ✅ | Part 10 |
| HSTS preload | ✅ | Nginx config |
| TLS 1.2+ only | ✅ | `ssl-params.conf` |
| Rate limiting (Nginx level) | Optional | Add `limit_req_zone` to nginx |
| DB user with least privilege | Recommended | Create `lms_user` with only DML on `suraksha-lms-db` |
| Cloud SQL private IP | Recommended | Use Auth Proxy + private IP instead of public |
| Log rotation | ✅ | PM2 + logrotate |
| Shielded VM | ✅ | Terraform compute module |

### SSH hardening (run on server)

```bash
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
echo "AllowUsers ubuntu" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### MySQL least-privilege user (run from Cloud SQL)

```sql
CREATE USER 'lms_user'@'127.0.0.1' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER
  ON `suraksha-lms-db`.* TO 'lms_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Then update `.env` / secrets: `DB_USERNAME=lms_user`, `DB_PASSWORD=STRONG_PASSWORD`.

---

## Part 18 — Rollback Procedure

```bash
# Backend rollback with PM2
pm2 reload lms-api --update-env   # zero-downtime reload
# If broken:
cd ~/apps/lms-api
git checkout HEAD~1               # roll back one commit
npm run build
pm2 restart lms-api

# Frontend rollback
# Keep previous dist in /var/www/lms-backup
cp -r /var/www/lms /var/www/lms-backup-$(date +%Y%m%d)
rsync -avz --delete dist/ ubuntu@SERVER_IP:/var/www/lms/
# Rollback:
rsync -avz --delete /var/www/lms-backup-YYYYMMDD/ /var/www/lms/
```

---

## Part 19 — Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `502 Bad Gateway` from API | PM2 process crashed | `pm2 logs lms-api` → fix error → `pm2 restart` |
| CORS error in browser | Origin not in `CORS_ORIGINS` | Add subdomain to `.env`, restart PM2 |
| Refresh token not sent | Cookie domain wrong | Apply code fix Part 0.4 |
| `403 on /health` | nginx config error | Check `proxy_pass` address and port |
| SSL cert expired | certbot timer stopped | `sudo certbot renew` |
| Matrix shows 0 students | Wrong student API response shape | Check `instituteStudentsApi.getStudentsByClass()` response; adjust field mapping |
| Firebase SW 404 | `firebase-messaging-sw.js` not in `dist/` | Ensure file is in `public/` before build |
| Large file upload 413 | nginx `client_max_body_size` | Already set to 15M in nginx config above |
| Slow first request | PM2 cluster mode cold start | Add `listen_timeout: 10000` (already set) |
