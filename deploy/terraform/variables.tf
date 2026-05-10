variable "project_id" {
  description = "Your GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (us-central1 has free-tier e2-micro eligibility)"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "machine_type" {
  description = "e2-small=~$12/mo  e2-medium=~$24/mo  e2-standard-2=~$48/mo"
  type        = string
  default     = "e2-small"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB (OS + Node app + logs)"
  type        = number
  default     = 30
}

variable "data_disk_size_gb" {
  description = "Persistent disk for Redis AOF/RDB data (survives VM re-create)"
  type        = number
  default     = 10
}

variable "ssh_user" {
  type    = string
  default = "ubuntu"
}

variable "ssh_public_key" {
  description = "Content of your ~/.ssh/id_rsa.pub"
  type        = string
}

variable "admin_cidr" {
  description = "Your IP/32 for SSH access, e.g. 203.0.113.10/32"
  type        = string
}

variable "db_tier" {
  description = "Cloud SQL machine tier. db-f1-micro=~$7/mo (shared 0.6 GB). db-g1-small=~$25/mo (dedicated 1.7 GB)"
  type        = string
  default     = "db-f1-micro"
}

variable "db_password" {
  description = "Password for the lms_user Cloud SQL account. Generate: openssl rand -base64 32 | tr -dc A-Za-z0-9 | head -c 32"
  type        = string
  sensitive   = true
}
