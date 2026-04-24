resource "azurerm_container_app_environment" "main" {
  name                               = "${var.cluster_name}-cae"
  resource_group_name                = azurerm_resource_group.main.name
  location                           = azurerm_resource_group.main.location
  infrastructure_subnet_id           = azapi_resource.aca_subnet.id
  infrastructure_resource_group_name = "${var.cluster_name}-cae-infra-rg"
  tags                               = var.tags

  workload_profile {
    maximum_count         = 0
    minimum_count         = 0
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

# azurerm_container_app_environment does not yet expose publicNetworkAccess, so patch
# it via azapi before the private endpoint is created — Azure rejects the PE if public
# access is still enabled.
resource "azapi_update_resource" "aca_disable_public_access" {
  type        = "Microsoft.App/managedEnvironments@2024-03-01"
  resource_id = azurerm_container_app_environment.main.id

  body = {
    properties = {
      publicNetworkAccess = "Disabled"
    }
  }
}

# # Private Endpoint for the Container App Environment.
# # Per BC Gov Landing Zone guidance, private_dns_zone_group is intentionally omitted —
# # the central connectivity subscription automatically creates the DNS A record in the
# # centralized Private DNS Zone within ~10 minutes of the endpoint being provisioned.
# resource "azurerm_private_endpoint" "aca" {
#   name                = "${var.cluster_name}-aca-pe"
#   resource_group_name = azurerm_resource_group.main.name
#   location            = azurerm_resource_group.main.location
#   subnet_id           = azapi_resource.aks_subnet.id
#   tags                = var.tags

#   private_service_connection {
#     name                           = "${var.cluster_name}-aca-psc"
#     private_connection_resource_id = azurerm_container_app_environment.main.id
#     subresource_names              = ["managedEnvironments"]
#     is_manual_connection           = false
#   }

#   depends_on = [azapi_update_resource.aca_disable_public_access]
# }

resource "azurerm_container_app" "showme" {
  name                         = "${var.cluster_name}-showme"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = var.tags

  workload_profile_name = "Consumption"

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }

  template {
    container {
      name   = "showme"
      image  = "${azurerm_container_registry.acr.login_server}/showme:latest"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  lifecycle {
    ignore_changes = [
      ingress[0].client_certificate_mode,
    ]
  }
}

