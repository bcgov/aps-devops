resource "azurerm_public_ip" "appgw" {
  name                = "${var.cluster_name}-appgw-pip"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

locals {
  appgw_name = "${var.cluster_name}-appgw"
  # Pre-computed ARM resource ID used to build sub-resource ID references
  # inside the AppGW body (listeners, rules, pools must reference each other
  # by full ARM ID when using azapi).
  appgw_id = "${azurerm_resource_group.main.id}/providers/Microsoft.Network/applicationGateways/${local.appgw_name}"
}

# azurerm_application_gateway does not support protocol = "Tcp" for listeners
# or backend settings (required for mTLS passthrough). azapi_resource uses the
# ARM REST API directly, which does support TCP protocol.
resource "azapi_resource" "appgw" {
  type      = "Microsoft.Network/applicationGateways@2025-05-01"
  name      = local.appgw_name
  parent_id = azurerm_resource_group.main.id
  location  = azurerm_resource_group.main.location
  tags      = var.tags

  body = {
    properties = {
      sku = {
        name     = var.appgw_sku
        tier     = var.appgw_sku
        capacity = var.appgw_capacity
      }

      sslPolicy = {
        policyType = "Predefined"
        policyName = "AppGwSslPolicy20220101S"
      }

      # WAF configuration is required by the WAF_v2 SKU. WAF inspection only
      # applies to HTTP/HTTPS listeners — TCP listeners bypass it transparently.
      webApplicationFirewallConfiguration = {
        enabled        = true
        firewallMode   = "Prevention"
        ruleSetType    = "OWASP"
        ruleSetVersion = "3.2"
      }

      # Trust the SDX CA so AppGW can validate Kong's self-signed backend cert.
      # Only added when ca_root is provided; omitting it falls back to well-known CAs.
      trustedRootCertificates = var.ca_root != "" ? [
        {
          name = "kong-ca"
          properties = {
            data = base64encode(var.ca_root)
          }
        }
      ] : null

      # Frontend TLS certificate for the HTTPS listener.
      # Generate a self-signed PFX with:
      #   openssl req -x509 -newkey rsa:2048 -keyout k.pem -out c.pem -days 365 -nodes -subj '/CN=<appgw-ip>'
      #   openssl pkcs12 -export -out cert.pfx -inkey k.pem -in c.pem -passout pass:changeme
      #   base64 -i cert.pfx | tr -d '\n'
      sslCertificates = var.appgw_ssl_cert_pfx != "" ? [
        {
          name = "appgw-ssl"
          properties = {
            data     = var.appgw_ssl_cert_pfx
            password = var.appgw_ssl_cert_password
          }
        }
      ] : null

      gatewayIPConfigurations = [
        {
          name = "appgw-ip-config"
          properties = {
            subnet = { id = azapi_resource.appgw_subnet.id }
          }
        }
      ]

      frontendIPConfigurations = [
        {
          name = "appgw-public-ip"
          properties = {
            publicIPAddress = { id = azurerm_public_ip.appgw.id }
          }
        }
      ]

      frontendPorts = [
        {
          name       = "http"
          properties = { port = 80 }
        },
        {
          name       = "https"
          properties = { port = 443 }
        }
      ]

      # Backend pool starts empty; terraform_data.appgw_backends populates it
      # with current node private IPs after the gateway is provisioned.
      backendAddressPools = [
        {
          name = "kong-backend"
          properties = {
            backendAddresses = []
          }
        }
      ]

      backendHttpSettingsCollection = [
        {
          name = "tcp-settings"
          properties = {
            port                           = 30443
            protocol                       = "Https"
            cookieBasedAffinity            = "Disabled"
            requestTimeout                 = 60
            pickHostNameFromBackendAddress = true
            trustedRootCertificates = var.ca_root != "" ? [
              { id = "${local.appgw_id}/trustedRootCertificates/kong-ca" }
            ] : null
          }
        }
      ]

      httpListeners = concat(
        [
          {
            name = "http-listener"
            properties = {
              frontendIPConfiguration = {
                id = "${local.appgw_id}/frontendIPConfigurations/appgw-public-ip"
              }
              frontendPort = {
                id = "${local.appgw_id}/frontendPorts/http"
              }
              protocol = "Http"
            }
          }
        ],
        var.appgw_ssl_cert_pfx != "" ? [
          {
            name = "https-listener"
            properties = {
              frontendIPConfiguration = {
                id = "${local.appgw_id}/frontendIPConfigurations/appgw-public-ip"
              }
              frontendPort = {
                id = "${local.appgw_id}/frontendPorts/https"
              }
              protocol      = "Https"
              sslCertificate = {
                id = "${local.appgw_id}/sslCertificates/appgw-ssl"
              }
            }
          }
        ] : []
      )

      requestRoutingRules = concat(
        [
          {
            name = "http-rule"
            properties = {
              ruleType = "Basic"
              priority = 100
              httpListener = {
                id = "${local.appgw_id}/httpListeners/http-listener"
              }
              backendAddressPool = {
                id = "${local.appgw_id}/backendAddressPools/kong-backend"
              }
              backendHttpSettings = {
                id = "${local.appgw_id}/backendHttpSettingsCollection/tcp-settings"
              }
            }
          }
        ],
        var.appgw_ssl_cert_pfx != "" ? [
          {
            name = "https-rule"
            properties = {
              ruleType = "Basic"
              priority = 110
              httpListener = {
                id = "${local.appgw_id}/httpListeners/https-listener"
              }
              backendAddressPool = {
                id = "${local.appgw_id}/backendAddressPools/kong-backend"
              }
              backendHttpSettings = {
                id = "${local.appgw_id}/backendHttpSettingsCollection/tcp-settings"
              }
            }
          }
        ] : []
      )
    }
  }

  # ignore_changes = [body] prevents Terraform from resetting backendAddressPools
  # to [] after terraform_data.appgw_backends populates it with node IPs.
  # Nested body paths (e.g. body.properties.x) crash the azapi provider because
  # body uses a dynamic type that the provider cannot navigate for ignore_changes.
  lifecycle {
    ignore_changes = [body]
  }
}

# Node IPs are unknown at plan time. This local-exec queries the AKS VMSS for
# current node IPs at apply time and syncs them into the AppGW backend pool.
# Re-run "terraform apply" after node pool scaling or upgrades to refresh.
resource "terraform_data" "appgw_backends" {
  triggers_replace = [
    azapi_resource.appgw.id,
    azurerm_kubernetes_cluster.main.id,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      set -e

      NODE_RG=$(az aks show \
        --name "${var.cluster_name}" \
        --resource-group "${azurerm_resource_group.main.name}" \
        --query nodeResourceGroup -o tsv)

      VMSS_NAME=$(az vmss list \
        --resource-group "$NODE_RG" \
        --query "[0].name" -o tsv)

      NODE_IPS=$(az vmss nic list \
        --resource-group "$NODE_RG" \
        --vmss-name "$VMSS_NAME" \
        --query "[].ipConfigurations[0].privateIPAddress" -o tsv | tr '\n' ' ')

      az network application-gateway address-pool update \
        --gateway-name "${local.appgw_name}" \
        --resource-group "${azurerm_resource_group.main.name}" \
        --name "kong-backend" \
        --servers $NODE_IPS \
        --no-wait
    EOT
  }
}
