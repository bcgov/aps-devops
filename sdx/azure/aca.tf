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

# Private Endpoint for the Container App Environment.
# Per BC Gov Landing Zone guidance, private_dns_zone_group is intentionally omitted —
# the central connectivity subscription automatically creates the DNS A record in the
# centralized Private DNS Zone within ~10 minutes of the endpoint being provisioned.
resource "azurerm_private_endpoint" "aca" {
  name                = "${var.cluster_name}-aca-pe"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  subnet_id           = azapi_resource.aks_subnet.id
  tags                = var.tags

  private_service_connection {
    name                           = "${var.cluster_name}-aca-psc"
    private_connection_resource_id = azurerm_container_app_environment.main.id
    subresource_names              = ["managedEnvironments"]
    is_manual_connection           = false
  }
}

resource "azurerm_container_app" "hello" {
  name                         = "${var.cluster_name}-hello"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = var.tags

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
      name   = "hello"
      image  = "${azurerm_container_registry.acr.login_server}/hello:latest"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 80

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# Separate AFD origin group for the hello world app.
# Unlike the Kong origin group, this uses a plain HTTPS health probe with no
# mTLS — useful for confirming AFD deployment works independently of Kong.
resource "azurerm_cdn_frontdoor_origin_group" "hello" {
  name                     = "hello"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  session_affinity_enabled = false

  load_balancing {
    sample_size                        = 4
    successful_samples_required        = 3
    additional_latency_in_milliseconds = 50
  }

  health_probe {
    path                = "/"
    request_type        = "HEAD"
    protocol            = "Https"
    interval_in_seconds = 30
  }
}

resource "azurerm_cdn_frontdoor_origin" "hello" {
  name                          = "hello"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.hello.id
  enabled                       = true

  host_name                      = azurerm_container_app.hello.ingress[0].fqdn
  http_port                      = 80
  https_port                     = 443
  origin_host_header             = azurerm_container_app.hello.ingress[0].fqdn
  priority                       = 1
  weight                         = 1000
  certificate_name_check_enabled = true
}

# Routes /hello and /hello/* to the container app.
# More specific than the Kong route (/*) so AFD prefers this for /hello paths.
resource "azurerm_cdn_frontdoor_route" "hello" {
  name                          = "hello"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.main.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.hello.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.hello.id]
  enabled                       = true

  forwarding_protocol    = "HttpsOnly"
  https_redirect_enabled = true
  patterns_to_match      = ["/hello", "/hello/*"]
  supported_protocols    = ["Http", "Https"]
  link_to_default_domain = true
}
