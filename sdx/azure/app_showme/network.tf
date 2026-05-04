# The VNet is pre-provisioned by the BC Gov Landing Zone — teams cannot create VNets.
data "azurerm_virtual_network" "main" {
  name                = var.vnet_name
  resource_group_name = var.vnet_resource_group_name
}

resource "azurerm_network_security_group" "aca" {
  name                = "${var.cluster_name}-aca-nsg"
  resource_group_name = var.resource_group_name
  location            = var.resource_group_location
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
