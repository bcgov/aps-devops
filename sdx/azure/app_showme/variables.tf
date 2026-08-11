variable "cluster_name" {
  description = "Name prefix used for all resources in this module."
  type        = string
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

variable "aca_subnet_cidr" {
  description = "CIDR for the Container App Environment infrastructure subnet — /27 minimum, must have Microsoft.App/environments delegation."
  type        = string
}

variable "resource_group_id" {
  description = "ID of the shared resource group."
  type        = string
}

variable "resource_group_name" {
  description = "Name of the shared resource group."
  type        = string
}

variable "resource_group_location" {
  description = "Azure region of the shared resource group."
  type        = string
}

variable "aks_subnet_id" {
  description = "AKS node subnet ID — used to place the ACA private endpoint."
  type        = string
}
