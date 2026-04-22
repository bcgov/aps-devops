output "resource_group_name" {
  description = "Resource group containing all deployed resources"
  value       = azurerm_resource_group.main.name
}

output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_get_credentials" {
  description = "Command to configure kubectl"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}


output "kong_lb_ip" {
  description = "Kong LoadBalancer public IP — clients connect here for mTLS"
  value       = azurerm_public_ip.kong_lb.ip_address
}

output "kong_lb_fqdn" {
  description = "Kong LoadBalancer FQDN (Azure DNS label) — use as CNAME target for edge_domain"
  value       = azurerm_public_ip.kong_lb.fqdn
}

output "edge_domain" {
  description = "SDX Edge virtual hostname — create a DNS CNAME pointing to kong_lb_fqdn"
  value       = local.edge_domain
}

output "helm_release_status" {
  description = "Status of the sdx-edge Helm release"
  value       = helm_release.sdx_edge.status
}
