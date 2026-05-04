variable "resource_group_name" {
  description = "Name of the resource group to create for this SDX edge deployment."
  type        = string
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "canadacentral"
}

variable "tags" {
  description = "Tags to apply to all resources."
  type        = map(string)
  default     = {}
}

variable "vnet_name" {
  description = "Name of the pre-provisioned BC Gov Landing Zone VNet."
  type        = string
}

variable "vnet_resource_group_name" {
  description = "Resource group containing the pre-provisioned Landing Zone VNet."
  type        = string
}

variable "cluster_name" {
  description = "Name of the AKS cluster."
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version for the AKS cluster."
  type        = string
  default     = null
}

variable "node_count" {
  description = "Initial number of nodes in the default node pool."
  type        = number
  default     = 3
}

variable "vm_size" {
  description = "VM size for AKS node pool."
  type        = string
  default     = "Standard_D2s_v3"
}

variable "aks_subnet_cidr" {
  description = "CIDR block for the AKS node subnet within the Landing Zone VNet."
  type        = string
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

variable "appgw_subnet_cidr" {
  description = "CIDR block for the Application Gateway subnet within the Landing Zone VNet."
  type        = string
}

variable "appgw_sku" {
  description = "SKU name and tier for the Application Gateway (e.g. WAF_v2, Standard_v2)."
  type        = string
  default     = "WAF_v2"
}

variable "appgw_capacity" {
  description = "Number of Application Gateway instances."
  type        = number
  default     = 2
}

variable "kong_node_port" {
  description = "NodePort on which Kong exposes its proxy (TCP passthrough from AppGW)."
  type        = number
  default     = 30443
}
