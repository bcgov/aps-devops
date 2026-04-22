variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = "sdx-edge-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "canadacentral"
}

variable "cluster_name" {
  description = "AKS cluster name"
  type        = string
  default     = "sdx-edge-aks"
}

variable "node_count" {
  description = "Number of AKS system nodes"
  type        = number
  default     = 2
}

variable "vm_size" {
  description = "AKS node VM size"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "kubernetes_version" {
  description = "Kubernetes version for AKS"
  type        = string
  default     = null
}

# SDX Edge deployment variables

variable "edge_id" {
  description = "SDX Edge identifier — used as the Helm release name and in the route hostname"
  type        = string
  default     = "my-edge"
}

variable "namespace" {
  description = "Kubernetes namespace to deploy sdx-edge into"
  type        = string
  default     = "sdx-edge"
}

variable "sdx_bootstrap_token" {
  description = "One-time bootstrap token for TLS certificate issuance from the CA"
  type        = string
  sensitive   = true
}

variable "sdx_control_url" {
  description = "SDX control plane URL in host:port format"
  type        = string
  default     = "sdx-cluster-api-gov-bc-ca.dev.api.gov.bc.ca:443"
}

variable "client_ca_url" {
  description = "Certificate authority endpoint for client certificate issuance"
  type        = string
  default     = "https://sdx-ca-api-gov-bc-ca.dev.api.gov.bc.ca"
}

variable "sdx_aggregator_url" {
  description = "SDX aggregator service endpoint"
  type        = string
  default     = "gwaggregator-api-gov-bc-ca.dev.api.gov.bc.ca"
}

variable "mtls_required" {
  description = "Require mutual TLS for client connections"
  type        = bool
  default     = true
}

variable "https_proxy" {
  description = "HTTP proxy URL for restricted network environments (leave empty to disable)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    project    = "sdx-edge"
    managed_by = "terraform"
  }
}
