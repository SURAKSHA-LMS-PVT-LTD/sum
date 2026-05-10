output "server_ip" {
  value       = google_compute_address.lms_ip.address
  description = "Set this as A record for all your subdomains in Cloudflare/registrar"
}

output "ssh_command" {
  value = "ssh ubuntu@${google_compute_address.lms_ip.address}"
}

output "cloudsql_connection_name" {
  value       = google_sql_database_instance.lms_db.connection_name
  description = "Pass this to 01-server-setup.sh when prompted for the Cloud SQL connection name"
}

output "cloudsql_instance_ip" {
  value       = google_sql_database_instance.lms_db.public_ip_address
  description = "Cloud SQL public IP (direct access blocked — only reachable via Auth Proxy)"
}

output "backup_bucket" {
  value       = google_storage_bucket.lms_backups.name
  description = "GCS bucket for on-demand SQL exports (set BACKUP_BUCKET env var on server)"
}

output "data_disk_device" {
  value       = "/dev/disk/by-id/google-data-disk"
  description = "Device name for the Redis data disk inside the VM"
}
