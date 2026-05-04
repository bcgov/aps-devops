output "resource_group_name" {
  description = "Resource group containing all deployed resources"
  value       = module.sdx_edge_infra.resource_group_name
}

output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = module.sdx_edge_infra.aks_cluster_name
}

output "aks_get_credentials" {
  description = "Command to configure kubectl"
  value       = module.sdx_edge_infra.aks_get_credentials
}


output "edge_domain" {
  description = "SDX Edge virtual hostname"
  value       = module.sdx_edge_server.edge_domain
}

output "helm_release_status" {
  description = "Status of the sdx-edge Helm release"
  value       = module.sdx_edge_server.helm_release_status
}

output "appgw_public_ip" {
  description = "Application Gateway public IP — internet-facing WAF entry point"
  value       = module.sdx_edge_infra.appgw_public_ip
}

output "acr_login_server" {
  description = "Container Registry login server for the ShowMe application"
  value       = module.app_showme.acr_login_server
}

output "aca_default_domain" {
  description = "Container App Environment default domain"
  value       = module.app_showme.aca_default_domain
}
