variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = "sdx-edge-rg"
}

variable "kubelogin_login_mode" {
  description = <<-EOT
    kubelogin login mode used by the kubernetes/helm providers to obtain an Entra ID
    token for the AKS API server. Use "azurecli" for interactive operators (relies on
    `az login`), "spn" for CI with a service principal (AAD_SERVICE_PRINCIPAL_CLIENT_ID /
    AAD_SERVICE_PRINCIPAL_CLIENT_SECRET env vars), "workloadidentity" for pods/runners
    using federated identity, or "msi" for managed identity on an Azure VM.
  EOT
  type        = string
  default     = "azurecli"

  validation {
    condition     = contains(["azurecli", "spn", "workloadidentity", "msi"], var.kubelogin_login_mode)
    error_message = "kubelogin_login_mode must be one of: azurecli, spn, workloadidentity, msi."
  }
}

variable "vnet_name" {
  description = "Name of the pre-provisioned VNet allocated by the BC Gov Landing Zone"
  type        = string
}

variable "vnet_resource_group_name" {
  description = "Resource group containing the Landing Zone VNet (may differ from resource_group_name)"
  type        = string
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

variable "admin_group_object_ids" {
  description = "List of Azure AD group object IDs to grant cluster admin permissions (e.g. BC Gov Admins)"
  type        = list(string)
  default     = []
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

variable "sdx_edge_chart_version" {
  description = "Version of the sdx-edge Helm chart to deploy"
  type        = string
  default     = "0.2.0"
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

variable "appgw_sku" {
  description = "Application Gateway SKU — WAF_v2 required for landing zone compliance"
  type        = string
  default     = "WAF_v2"
}

variable "appgw_capacity" {
  description = "Application Gateway instance count"
  type        = number
  default     = 1
}

variable "aks_subnet_cidr" {
  description = "CIDR for the AKS node/pod subnet — must be within the Landing Zone VNet address space"
  type        = string
  default     = "10.46.8.128/26"
}

variable "aca_subnet_cidr" {
  description = "CIDR for the Container App Environment infrastructure subnet — /27 minimum, must have Microsoft.App/environments delegation"
  type        = string
  default     = "10.46.8.192/27"
}

variable "appgw_subnet_cidr" {
  description = "CIDR for the Application Gateway subnet — must be within the Landing Zone VNet address space"
  type        = string
  default     = "10.46.8.96/28"
}

variable "pod_cidr" {
  description = "Kubernetes pod CIDR for Azure CNI Overlay — must be within the BC Gov approved range 10.10.0.0/18"
  type        = string
  default     = "10.10.0.0/18"
}

variable "service_cidr" {
  description = "Kubernetes service CIDR — must be within the BC Gov approved range 10.10.64.0/22"
  type        = string
  default     = "10.10.64.0/22"
}

variable "dns_service_ip" {
  description = "IP address for the Kubernetes DNS service — must be within service_cidr"
  type        = string
  default     = "10.10.64.10"
}

variable "kong_node_port" {
  description = "Fixed Kubernetes NodePort for Kong HTTPS — must be in range 30000-32767; used by the Application Gateway backend"
  type        = number
  default     = 30443
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    project    = "sdx-edge"
    managed_by = "terraform"
  }
}
