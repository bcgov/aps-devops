resource "azurerm_public_ip" "appgw_aca" {
  name                = "${var.cluster_name}-appgw-aca-pip"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_network_security_group" "appgw_aca" {
  name                = "${var.cluster_name}-appgw-aca-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags

  security_rule {
    name                       = "allow-gateway-manager"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "65200-65535"
    source_address_prefix      = "GatewayManager"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-https-inbound"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-http-inbound"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-azure-lb-probe"
    priority                   = 130
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "AzureLoadBalancer"
    destination_address_prefix = "*"
  }
}

resource "azapi_resource" "appgw_aca_subnet" {
  type      = "Microsoft.Network/virtualNetworks/subnets@2023-09-01"
  name      = "appgw-aca-subnet"
  parent_id = data.azurerm_virtual_network.main.id

  body = {
    properties = {
      addressPrefix = var.appgw_aca_subnet_cidr
      networkSecurityGroup = {
        id = azurerm_network_security_group.appgw_aca.id
      }
      defaultOutboundAccess = false
    }
  }
}

# # Reuse the same route table as the existing AppGW subnet — forces 0.0.0.0/0
# # to Internet to prevent asymmetric routing through the vWAN hub.
# resource "azurerm_subnet_route_table_association" "appgw_aca" {
#   subnet_id      = azapi_resource.appgw_aca_subnet.id
#   route_table_id = azurerm_route_table.appgw.id
# }

# Uses azurerm_application_gateway (not azapi) since no TCP passthrough is needed —
# the Container App backend speaks standard HTTPS with an Azure-managed certificate.
resource "azurerm_application_gateway" "aca" {
  name                = "${var.cluster_name}-appgw-aca"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags

  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 1
  }

  ssl_policy {
    policy_type = "Predefined"
    policy_name = "AppGwSslPolicy20220101S"
  }

  waf_configuration {
    enabled          = true
    firewall_mode    = "Prevention"
    rule_set_type    = "OWASP"
    rule_set_version = "3.2"
  }

  gateway_ip_configuration {
    name      = "appgw-aca-ip-config"
    subnet_id = azapi_resource.appgw_aca_subnet.id
  }

  frontend_ip_configuration {
    name                 = "appgw-aca-public-ip"
    public_ip_address_id = azurerm_public_ip.appgw_aca.id
  }

  frontend_port {
    name = "http"
    port = 80
  }

  # Backend is the Container App public FQDN — Azure-managed cert is trusted by
  # default so no trusted_root_certificate block is needed.
  backend_address_pool {
    name  = "aca-backend"
    fqdns = [azurerm_container_app.hello.ingress[0].fqdn]
  }

  backend_http_settings {
    name                                = "aca-https-settings"
    cookie_based_affinity               = "Disabled"
    port                                = 443
    protocol                            = "Https"
    request_timeout                     = 30
    pick_host_name_from_backend_address = true
  }

  http_listener {
    name                           = "http-listener"
    frontend_ip_configuration_name = "appgw-aca-public-ip"
    frontend_port_name             = "http"
    protocol                       = "Http"
  }

  request_routing_rule {
    name                       = "http-rule"
    rule_type                  = "Basic"
    priority                   = 100
    http_listener_name         = "http-listener"
    backend_address_pool_name  = "aca-backend"
    backend_http_settings_name = "aca-https-settings"
  }

  # depends_on = [azurerm_subnet_route_table_association.appgw_aca]
}
