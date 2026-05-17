terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Remote state in GCS — prevents state loss if your laptop dies and allows
  # team members to run terraform safely.
  # Setup (one-time, before first terraform init):
  #   gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-tfstate
  #   gsutil versioning set on gs://YOUR_PROJECT_ID-tfstate
  # Then uncomment this block and replace YOUR_PROJECT_ID:
  #
  # backend "gcs" {
  #   bucket  = "YOUR_PROJECT_ID-tfstate"
  #   prefix  = "lms/prod"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Enable required APIs ──────────────────────────────────────────────────────
resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "sqladmin" {
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

# ── VM Service Account ────────────────────────────────────────────────────────
# The VM uses this SA to authenticate the Cloud SQL Auth Proxy + write backups
resource "google_service_account" "vm_sa" {
  account_id   = "lms-vm-sa"
  display_name = "LMS VM — Cloud SQL Auth + GCS Backups"
  project      = var.project_id
  depends_on   = [google_project_service.iam]
}

resource "google_project_iam_member" "vm_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.vm_sa.email}"
}

resource "google_project_iam_member" "vm_storage_writer" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.vm_sa.email}"
}

# ── GCS bucket for backup exports ────────────────────────────────────────────
resource "google_storage_bucket" "lms_backups" {
  name          = "${var.project_id}-lms-backups"
  location      = var.region
  force_destroy = false

  lifecycle_rule {
    condition { age = 30 }
    action    { type = "Delete" }
  }

  uniform_bucket_level_access = true
  depends_on                  = [google_project_service.storage]
}

# Cloud SQL service account needs objectAdmin on the bucket to write exports
resource "google_storage_bucket_iam_member" "cloudsql_gcs_writer" {
  bucket = google_storage_bucket.lms_backups.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_sql_database_instance.lms_db.service_account_email_address}"
}

# ── Cloud SQL — MySQL 8.0 ─────────────────────────────────────────────────────
resource "google_sql_database_instance" "lms_db" {
  name             = "lms-mysql"
  database_version = "MYSQL_8_0"
  region           = var.region

  # Prevent accidental deletion — set false only when intentionally destroying
  deletion_protection = true

  settings {
    tier              = var.db_tier   # db-f1-micro ≈ $7/mo
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10            # GB; autoresize will grow it
    disk_autoresize   = true
    disk_autoresize_limit = 100

    # Automated backups: 14 daily snapshots + binary log for PITR
    backup_configuration {
      enabled                        = true
      binary_log_enabled             = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 14
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled = true
      require_ssl  = true
      # No authorized_networks — direct TCP blocked; only the Auth Proxy can connect
    }

    database_flags {
      name  = "character_set_server"
      value = "utf8mb4"
    }
    database_flags {
      name  = "collation_server"
      value = "utf8mb4_unicode_ci"
    }
    database_flags {
      name  = "slow_query_log"
      value = "on"
    }
    database_flags {
      name  = "long_query_time"
      value = "2"
    }

    maintenance_window {
      day          = 7   # Sunday
      hour         = 4
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = false
    }
  }

  depends_on = [google_project_service.sqladmin]
}

resource "google_sql_database" "lms_database" {
  name      = "suraksha_lms_db"
  instance  = google_sql_database_instance.lms_db.name
  charset   = "utf8mb4"
  collation = "utf8mb4_unicode_ci"
}

resource "google_sql_user" "lms_user" {
  name     = "lms_user"
  instance = google_sql_database_instance.lms_db.name
  password = var.db_password
  host     = "%"
}

# ── Static external IP ────────────────────────────────────────────────────────
resource "google_compute_address" "lms_ip" {
  name   = "lms-static-ip"
  region = var.region
}

# ── Firewall: HTTPS + HTTP from anywhere ──────────────────────────────────────
resource "google_compute_firewall" "allow_web" {
  name    = "lms-allow-web"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["lms-server"]
}

# ── Firewall: SSH only from your admin IP ─────────────────────────────────────
resource "google_compute_firewall" "allow_ssh" {
  name    = "lms-allow-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  source_ranges = [var.admin_cidr]
  target_tags   = ["lms-server"]
}

# ── Firewall: block ALL other ingress ─────────────────────────────────────────
resource "google_compute_firewall" "deny_other" {
  name      = "lms-deny-other-ingress"
  network   = "default"
  direction = "INGRESS"
  priority  = 65000

  deny { protocol = "all" }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["lms-server"]
}

# ── Persistent disk for Redis data ────────────────────────────────────────────
# MySQL is now Cloud SQL — this disk is for Redis AOF/RDB persistence only
resource "google_compute_disk" "data_disk" {
  name  = "lms-data-disk"
  type  = "pd-standard"
  zone  = var.zone
  size  = var.data_disk_size_gb   # 10 GB is plenty for Redis
}

# ── Ubuntu 22.04 LTS image ────────────────────────────────────────────────────
data "google_compute_image" "ubuntu" {
  family  = "ubuntu-2204-lts"
  project = "ubuntu-os-cloud"
}

# ── VM instance ───────────────────────────────────────────────────────────────
resource "google_compute_instance" "lms" {
  name         = "lms-server"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["lms-server"]

  boot_disk {
    initialize_params {
      image = data.google_compute_image.ubuntu.self_link
      size  = var.disk_size_gb
      type  = "pd-ssd"
    }
  }

  attached_disk {
    source      = google_compute_disk.data_disk.self_link
    device_name = "data-disk"
    mode        = "READ_WRITE"
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.lms_ip.address
    }
  }

  # Service account enables Auth Proxy to authenticate via metadata server
  service_account {
    email  = google_service_account.vm_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${var.ssh_public_key}"
    # Disable OS Login so plain SSH keys work
    enable-oslogin         = "false"
    block-project-ssh-keys = "true"
    serial-port-enable     = "false"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  scheduling {
    on_host_maintenance = "MIGRATE"
    automatic_restart   = true
    preemptible         = false
  }

  labels = {
    env = "production"
    app = "lms"
  }

  depends_on = [
    google_project_service.compute,
    google_service_account.vm_sa,
    google_project_iam_member.vm_cloudsql_client,
  ]
}
