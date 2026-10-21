output "resource_group_name" {
  description = "Resource group containing all deployed resources."
  value       = azurerm_resource_group.main.name
}

output "aks_cluster_name" {
  description = "AKS cluster name."
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_get_credentials" {
  description = "Command to configure kubectl for this cluster."
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

output "appgw_public_ip" {
  description = "Application Gateway public IP — internet-facing WAF entry point."
  value       = azurerm_public_ip.appgw.ip_address
}

output "resource_group_id" {
  description = "Resource group ID."
  value       = azurerm_resource_group.main.id
}

output "resource_group_location" {
  description = "Resource group Azure region."
  value       = azurerm_resource_group.main.location
}

output "aks_cluster_id" {
  description = "AKS cluster resource ID."
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_subnet_id" {
  description = "AKS node subnet resource ID."
  value       = azapi_resource.aks_subnet.id
}

output "kube_config" {
  description = "AKS cluster kubeconfig credentials."
  sensitive   = true
  value       = azurerm_kubernetes_cluster.main.kube_config[0]
}
