#!/usr/bin/env bash
# =============================================================================
# 06-backup.sh
# On-demand Cloud SQL export to GCS.
#
# Cloud SQL already runs AUTOMATED daily backups (14 retained) with binary log
# PITR — this script adds an off-instance copy to GCS for extra durability.
#
# Install: cp 06-backup.sh ~/scripts/backup.sh && chmod +x ~/scripts/backup.sh
# Cron:    0 3 * * * /home/ubuntu/scripts/backup.sh >> /var/log/lms-backup.log 2>&1
#
# Requirements:
#   - gcloud CLI installed (google-cloud-cli package, installed in 01-server-setup.sh)
#   - VM service account has roles/cloudsql.client + roles/storage.objectCreator
#   - BACKUP_BUCKET env var set (from: terraform output -raw backup_bucket)
# =============================================================================
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_NAME="suraksha_lms_db"
INSTANCE="${CLOUDSQL_INSTANCE:-lms-mysql}"

# BACKUP_BUCKET must be set (e.g. in ~/.bashrc or crontab)
if [[ -z "${BACKUP_BUCKET:-}" ]]; then
  # Attempt to auto-detect from project metadata
  PROJECT=$(curl -sf "http://metadata.google.internal/computeMetadata/v1/project/project-id" \
    -H "Metadata-Flavor: Google" 2>/dev/null || echo "")
  if [[ -n "$PROJECT" ]]; then
    BACKUP_BUCKET="${PROJECT}-lms-backups"
  else
    echo "[ERROR] BACKUP_BUCKET env var not set. Export it first:"
    echo "  export BACKUP_BUCKET=\$(gcloud projects describe \$PROJECT_ID --format='value(projectId)')-lms-backups"
    exit 1
  fi
fi

EXPORT_URI="gs://${BACKUP_BUCKET}/mysql-${DB_NAME}-${TIMESTAMP}.sql.gz"

echo "[$(date)] ── Starting Cloud SQL export ──────────────────────────────────"
echo "[$(date)] Instance : $INSTANCE"
echo "[$(date)] Database : $DB_NAME"
echo "[$(date)] Target   : $EXPORT_URI"

# --offload: export runs on a secondary replica, no impact on primary performance
gcloud sql export sql "$INSTANCE" "$EXPORT_URI" \
  --database="$DB_NAME" \
  --offload \
  --quiet

echo "[$(date)] Export complete → $EXPORT_URI"
echo "[$(date)] GCS lifecycle policy deletes exports older than 30 days (set in Terraform)"
echo ""
echo "[$(date)] Cloud SQL automated backups (via GCP console):"
echo "  View:    gcloud sql backups list --instance=$INSTANCE"
echo "  Restore: gcloud sql backups restore BACKUP_ID --restore-instance=$INSTANCE"
echo ""
echo "[$(date)] ── Done ─────────────────────────────────────────────────────────"
