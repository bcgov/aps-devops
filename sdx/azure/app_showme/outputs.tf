output "acr_login_server" {
  description = "Container registry login server hostname."
  value       = azurerm_container_registry.acr.login_server
}

output "aca_default_domain" {
  description = "Default domain of the Container App Environment."
  value       = azapi_resource.aca_environment.output.properties.defaultDomain
}
