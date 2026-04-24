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
  description = "Kong public LoadBalancer IP — internet-facing, origin for Azure Front Door"
  value       = azurerm_public_ip.kong_lb.ip_address
}

output "afd_endpoint" {
  description = "Azure Front Door endpoint hostname — public internet entry point with WAF"
  value       = azurerm_cdn_frontdoor_endpoint.main.host_name
}

output "edge_domain" {
  description = "SDX Edge virtual hostname — create a DNS CNAME pointing to afd_endpoint"
  value       = local.edge_domain
}

output "helm_release_status" {
  description = "Status of the sdx-edge Helm release"
  value       = helm_release.sdx_edge.status
}

output "appgw_public_ip" {
  description = "Application Gateway public IP — internet-facing WAF entry point"
  value       = azurerm_public_ip.appgw.ip_address
}
