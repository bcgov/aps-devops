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

  # AFD backend PoPs forward to the public Kong LB (443); the LB routes to this
  # NodePort on each node. Source service tag covers all AFD backend address ranges.
  security_rule {
    name                       = "allow-nodeport-from-afd"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = tostring(var.kong_node_port)
    source_address_prefix      = "AzureFrontDoor.Backend"
    destination_address_prefix = "*"
  }

  # AppGW routes directly to node private IPs on the NodePort, bypassing the
  # public Kong LB and avoiding UDR/hub-firewall routing for internal traffic.
  security_rule {
    name                       = "allow-nodeport-from-appgw"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = tostring(var.kong_node_port)
    source_address_prefix      = var.appgw_subnet_cidr
    destination_address_prefix = "*"
  }

  # Azure Load Balancer health probes originate from 168.63.129.16;
  # this rule must exist or the LB marks all backends unhealthy and drops traffic
  security_rule {
    name                       = "allow-azure-lb-probe"
    priority                   = 120
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

resource "azurerm_network_security_group" "aca" {
  name                = "${var.cluster_name}-aca-nsg"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags

  security_rule {
    name                       = "allow-azure-lb-probe"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "AzureLoadBalancer"
    destination_address_prefix = "*"
  }
}

# Container Apps requires Microsoft.App/environments delegation on the infrastructure
# subnet. The azapi provider creates NSG + delegation atomically to satisfy the
# Landing Zone policy that rejects subnets without an NSG.
resource "azapi_resource" "aca_subnet" {
  type      = "Microsoft.Network/virtualNetworks/subnets@2023-09-01"
  name      = "aca-subnet"
  parent_id = data.azurerm_virtual_network.main.id

  body = {
    properties = {
      addressPrefix = var.aca_subnet_cidr
      networkSecurityGroup = {
        id = azurerm_network_security_group.aca.id
      }
      delegations = [{
        name = "aca-delegation"
        properties = {
          serviceName = "Microsoft.App/environments"
        }
      }]
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

