# App Gateway subnet
#
# IMPORTANT: In VWAN spoke VNets with useRemoteGateways=true, a route table with
# 0.0.0.0/0 → Internet is REQUIRED. Without it, the VWAN hub's default route
# causes asymmetric routing: inbound traffic arrives at the App GW public IP
# directly, but return traffic goes through the VWAN hub, and gets dropped.
# See: https://learn.microsoft.com/en-us/azure/application-gateway/configuration-infrastructure#virtual-network-and-dedicated-subnet

# resource "azurerm_route_table" "appgw" {
#   name                = "${var.cluster_name}-appgw-rt"
#   location            = var.location
#   resource_group_name = azurerm_resource_group.main.name
#   tags                = var.tags

#   lifecycle {
#     ignore_changes = [tags]
#   }
# }

# resource "azurerm_route" "appgw_internet" {
#   name                = "default-internet"
#   resource_group_name = azurerm_resource_group.main.name
#   route_table_name    = azurerm_route_table.appgw.name

#   address_prefix = "0.0.0.0/0"
#   next_hop_type  = "Internet"
# }

# # Avoids asymmetric routing via ExpressRoute for BC Gov internal ranges.
# resource "azurerm_route" "appgw_bcgov_internal" {
#   name                = "bcgov-internal"
#   resource_group_name = azurerm_resource_group.main.name
#   route_table_name    = azurerm_route_table.appgw.name

#   address_prefix = "142.34.0.0/16"
#   next_hop_type  = "Internet"
# }

# # Associate the route table with the AppGW subnet so the routes take effect.
# resource "azurerm_subnet_route_table_association" "appgw" {
#   subnet_id      = azapi_resource.appgw_subnet.id
#   route_table_id = azurerm_route_table.appgw.id
# }
