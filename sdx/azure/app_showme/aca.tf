# azurerm_container_app_environment does not expose publicNetworkAccess, so we use
# azapi_resource directly to set it at creation time — avoiding the race condition
# where a separate azapi_update_resource patch would race with private endpoint creation.
resource "azapi_resource" "aca_environment" {
  type                      = "Microsoft.App/managedEnvironments@2025-07-01"
  name                      = "${var.cluster_name}-cae"
  parent_id                 = var.resource_group_id
  location                  = var.resource_group_location
  schema_validation_enabled = false
  tags                      = var.tags

  body = {
    properties = {
      vnetConfiguration = {
        infrastructureSubnetId = azapi_resource.aca_subnet.id
      }
      infrastructureResourceGroup = "${var.cluster_name}-cae-infra-rg"
      publicNetworkAccess         = "Disabled"
      workloadProfiles = [
        {
          name                = "Consumption"
          workloadProfileType = "Consumption"
        }
      ]
    }
  }

  response_export_values = ["properties.defaultDomain", "properties.staticIp"]
}

# Private Endpoint for the Container App Environment.
# Per BC Gov Landing Zone guidance, private_dns_zone_group is intentionally omitted —
# the central connectivity subscription automatically creates the DNS A record in the
# centralized Private DNS Zone within ~10 minutes of the endpoint being provisioned.
resource "azurerm_private_endpoint" "aca" {
  name                = "${var.cluster_name}-aca-pe"
  resource_group_name = var.resource_group_name
  location            = var.resource_group_location
  subnet_id           = var.aks_subnet_id
  tags                = var.tags

  private_service_connection {
    name                           = "${var.cluster_name}-aca-psc"
    private_connection_resource_id = azapi_resource.aca_environment.id
    subresource_names              = ["managedEnvironments"]
    is_manual_connection           = false
  }

  lifecycle {
    ignore_changes = [
      private_dns_zone_group,
    ]
  }
}

resource "azurerm_container_app" "showme" {
  name                         = "${var.cluster_name}-showme"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azapi_resource.aca_environment.id
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
    min_replicas = 1
    max_replicas = 1

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
