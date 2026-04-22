resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

locals {
  edge_domain   = "${var.edge_id}.servers.sdx"
  kong_svc_name = "sdx-edge-${var.edge_id}"
}
