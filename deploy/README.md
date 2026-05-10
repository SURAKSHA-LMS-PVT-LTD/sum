# Suraksha LMS — Deployment

## Architecture

```
GCP VM (Ubuntu 22.04)  ← 1 VM — app + Nginx + Redis
 ├── Nginx              ← TLS termination, static files, reverse proxy (free)
 │    ├── lms.suraksha.lk        → /var/www/lms   (React SPA)
 │    ├── org.suraksha.lk        → /var/www/org
 │    ├── admin.suraksha.lk      → /var/www/admin
 │    ├── transport.suraksha.lk  → /var/www/transport
 │    └── lmsapi.suraksha.lk     → 127.0.0.1:8080
 ├── NestJS API         ← PM2 cluster (free)
 ├── Cloud SQL Auth Proxy → connects to Cloud SQL MySQL 8.0
 ├── Redis 7            ← self-hosted on VM (free)
 └── Let's Encrypt      ← free SSL
Cloud SQL (MySQL 8.0)  ← managed DB: auto-backups, PITR, no maintenance
AWS S3                 ← file storage (existing, pay per use)
GCS Bucket             ← daily SQL export backups (Terraform-provisioned)
```

**No Secret Manager — credentials via .env files**

---

## Quick start — 6 steps

### Step 1 — Provision GCP VM + Cloud SQL with Terraform

```bash
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — fill project_id, admin_cidr, ssh_public_key, db_password

terraform init
terraform plan
terraform apply

# Note these outputs — you'll need them:
terraform output server_ip               # → set DNS A records
terraform output cloudsql_connection_name  # → needed by 01-server-setup.sh
terraform output backup_bucket           # → set BACKUP_BUCKET in .env
```

> **Cloud SQL first-run takes ~10 minutes** — the instance creation is the slow part.

Then set DNS A records at your registrar / Cloudflare (all free):
```
lms.suraksha.lk        A  →  SERVER_IP
lmsapi.suraksha.lk     A  →  SERVER_IP
org.suraksha.lk        A  →  SERVER_IP
admin.suraksha.lk      A  →  SERVER_IP
transport.suraksha.lk  A  →  SERVER_IP
```

### Step 2 — Bootstrap the server

```bash
ssh ubuntu@SERVER_IP

# Upload setup script
scp deploy/scripts/01-server-setup.sh ubuntu@SERVER_IP:~/
ssh ubuntu@SERVER_IP 'bash ~/01-server-setup.sh'
```

The script installs: Node 20, PM2, MySQL 8, Redis, Nginx, Certbot, UFW, fail2ban.
Generated passwords are saved to `~/credentials.txt`.

### Step 3 — Create .env

```bash
# On the server:
cp /path/to/deploy/env/backend.env ~/apps/lms-api/.env
nano ~/apps/lms-api/.env
chmod 600 ~/apps/lms-api/.env
```

Fill these values:

| Variable | Where to get it |
|---|---|
| `DB_PASSWORD` | `db_password` from your `terraform.tfvars` |
| `REDIS_PASSWORD` | `~/credentials.txt` on the server |
| `BACKUP_BUCKET` | `terraform output -raw backup_bucket` |
| `JWT_SECRET` | `openssl rand -base64 64 \| tr -d '\n'` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 64 \| tr -d '\n'` |
| `BCRYPT_PEPPER` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` |

`DB_HOST=127.0.0.1` and `DB_PORT=3306` are correct as-is — the Cloud SQL Auth Proxy is already running on those coordinates.

### Step 4 — Deploy backend

```bash
# On the server — clone + build + start PM2
scp deploy/scripts/02-deploy-backend.sh ubuntu@SERVER_IP:~/
ssh ubuntu@SERVER_IP 'bash ~/02-deploy-backend.sh'
```

### Step 5 — Deploy frontend

```bash
# On your LOCAL machine — builds and uploads via rsync
cp deploy/env/frontend.env "lms user frotend/.env.production"
nano "lms user frotend/.env.production"   # fill Firebase keys

SERVER_IP=YOUR_IP bash deploy/scripts/03-deploy-frontend.sh
```

### Step 6 — SSL certificates (DNS must resolve first!)

```bash
# On the server:
scp deploy/scripts/04-ssl-setup.sh ubuntu@SERVER_IP:~/
ssh ubuntu@SERVER_IP 'bash ~/04-ssl-setup.sh admin@suraksha.lk'
```

---

## File layout

```
deploy/
  terraform/
    main.tf                    ← GCP VM, static IP, firewall
    variables.tf
    outputs.tf
    terraform.tfvars.example   ← copy → terraform.tfvars (gitignored)
  nginx/
    snippets/
      ssl-params.conf          ← TLS 1.2+, HSTS, OCSP stapling
      security-headers.conf    ← CSP, X-Frame-Options, etc.
    sites/
      lmsapi.suraksha.lk.conf  ← API reverse proxy
      lms.suraksha.lk.conf     ← LMS student portal
      org.suraksha.lk.conf
      admin.suraksha.lk.conf
      transport.suraksha.lk.conf
  pm2/
    ecosystem.config.js        ← cluster mode, memory guard, logs
  env/
    backend.env                ← template — copy to server, fill secrets
    frontend.env               ← template — copy to lms user frotend/.env.production
  scripts/
    01-server-setup.sh         ← installs everything on a fresh VM
    02-deploy-backend.sh       ← clone/pull, build, PM2 start/reload
    03-deploy-frontend.sh      ← build locally, rsync to server
    04-ssl-setup.sh            ← certbot for all 5 subdomains
    05-db-migrate.sh           ← run TypeORM migrations
    06-backup.sh               ← daily MySQL backup (add to cron)
    07-nginx-add-domain.sh     ← add a custom institute domain
```

---

## Daily backup cron (set up on server)

```bash
mkdir -p ~/scripts
cp deploy/scripts/06-backup.sh ~/scripts/backup.sh
chmod +x ~/scripts/backup.sh

# Add to crontab:
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/scripts/backup.sh >> /var/log/lms-backup.log 2>&1") | crontab -
```

---

## Useful commands

```bash
# API status
pm2 status
pm2 logs lms-api --lines 100

# API restart (zero-downtime)
pm2 reload lms-api --update-env

# Nginx test + reload
sudo nginx -t && sudo systemctl reload nginx

# Check SSL expiry
sudo certbot certificates

# MySQL
mysql -h 127.0.0.1 -u lms_user -p suraksha_lms_db

# Redis
redis-cli -a YOUR_REDIS_PASS ping

# Firewall
sudo ufw status verbose

# fail2ban
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

---

## Cost estimate (GCP, us-central1)

| Resource | Cost/month |
|----------|-----------|
| e2-small VM (2 vCPU shared, 2 GB) | ~$12 |
| 30 GB SSD boot disk | ~$5 |
| 10 GB standard data disk (Redis) | ~$0.40 |
| Cloud SQL db-f1-micro (0.6 GB, 10 GB SSD) | ~$7 |
| Cloud SQL automated backups (14 days) | ~$0.50 |
| 1 static IP (attached, running) | free |
| GCS backup bucket (~1 GB) | ~$0.02 |
| Egress ~10 GB | ~$1.20 |
| **Total** | **~$26/month** |

Redis, Nginx, PM2, Let's Encrypt = **$0** (open source).
Cloud SQL replaces self-hosted MySQL — adds ~$7/mo but provides automated backups,
point-in-time recovery, and zero maintenance.
