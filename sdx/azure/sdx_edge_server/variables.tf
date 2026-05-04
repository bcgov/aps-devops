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

variable "kong_node_port" {
  description = "Fixed Kubernetes NodePort for Kong HTTPS — must be in range 30000-32767"
  type        = number
  default     = 30443
}

variable "appgw_public_ip" {
  description = "Application Gateway public IP — embedded as a SAN on the Kong server certificate"
  type        = string
}
