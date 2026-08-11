resource "azurerm_public_ip" "appgw" {
  name                = "${var.cluster_name}-appgw-pip"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_web_application_firewall_policy" "appgw" {
  name                = "${var.cluster_name}-waf-policy"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags

  policy_settings {
    enabled                     = true
    mode                        = "Prevention"
    request_body_check          = true
    max_request_body_size_in_kb = 128
    file_upload_limit_in_mb     = 100
  }

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
    }
  }
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

      # Required by BC Gov Landing Zone policy regardless of listener protocol.
      sslPolicy = {
        policyType = "Predefined"
        policyName = "AppGwSslPolicy20220101S"
      }

      # WAF policy is attached by reference; the inline webApplicationFirewallConfiguration
      # block has been retired. WAF inspection applies to HTTP/HTTPS listeners only —
      # TCP listeners bypass it transparently.
      firewallPolicy = {
        id = azurerm_web_application_firewall_policy.appgw.id
      }

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

      # L4 TCP backend settings — AppGW forwards raw bytes to Kong on the NodePort;
      # Kong owns TLS termination and mTLS client certificate validation.
      backendSettingsCollection = [
        {
          name = "tcp-settings"
          properties = {
            port     = var.kong_node_port
            protocol = "Tcp"
            timeout  = 60
          }
        }
      ]

      # L4 TCP listener — no TLS termination at AppGW; SNI passes through to Kong.
      listeners = [
        {
          name = "tcp-listener"
          properties = {
            frontendIPConfiguration = {
              id = "${local.appgw_id}/frontendIPConfigurations/appgw-public-ip"
            }
            frontendPort = {
              id = "${local.appgw_id}/frontendPorts/https"
            }
            protocol = "Tcp"
          }
        }
      ]

      routingRules = [
        {
          name = "tcp-rule"
          properties = {
            ruleType = "Basic"
            priority = 100
            listener = {
              id = "${local.appgw_id}/listeners/tcp-listener"
            }
            backendAddressPool = {
              id = "${local.appgw_id}/backendAddressPools/kong-backend"
            }
            backendSettings = {
              id = "${local.appgw_id}/backendSettingsCollection/tcp-settings"
            }
          }
        }
      ]
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
