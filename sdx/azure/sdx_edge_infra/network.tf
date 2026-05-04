# The VNet is pre-provisioned by the BC Gov Landing Zone — teams cannot create VNets.
data "azurerm_virtual_network" "main" {
  name                = var.vnet_name
  resource_group_name = var.vnet_resource_group_name
}

resource "azurerm_network_security_group" "aks" {
  name                = "${var.cluster_name}-aks-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags

  # AppGW routes directly to node private IPs on the NodePort.
  security_rule {
    name                       = "allow-nodeport-from-appgw"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = tostring(var.kong_node_port)
    source_address_prefix      = var.appgw_subnet_cidr
    destination_address_prefix = "*"
  }

  # Azure health probes originate from 168.63.129.16 — required for the AKS implicit Standard LB.
  security_rule {
    name                       = "allow-azure-lb-probe"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "AzureLoadBalancer"
    destination_address_prefix = "*"
  }
}

# azapi creates the subnet with the NSG in a single ARM call, satisfying the
# Landing Zone policy that rejects subnets created without an NSG.
resource "azapi_resource" "aks_subnet" {
  type      = "Microsoft.Network/virtualNetworks/subnets@2023-09-01"
  name      = "aks-subnet"
  parent_id = data.azurerm_virtual_network.main.id

  body = {
    properties = {
      addressPrefix = var.aks_subnet_cidr
      networkSecurityGroup = {
        id = azurerm_network_security_group.aks.id
      }
      defaultOutboundAccess = false
    }
  }
}

resource "azurerm_network_security_group" "appgw" {
  name                = "${var.cluster_name}-appgw-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags

  # Required for Application Gateway v2 management traffic from the Azure control plane
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

resource "azapi_resource" "appgw_subnet" {
  type      = "Microsoft.Network/virtualNetworks/subnets@2023-09-01"
  name      = "appgw-subnet"
  parent_id = data.azurerm_virtual_network.main.id

  body = {
    properties = {
      addressPrefix = var.appgw_subnet_cidr
      networkSecurityGroup = {
        id = azurerm_network_security_group.appgw.id
      }
      defaultOutboundAccess = false
    }
  }
}

