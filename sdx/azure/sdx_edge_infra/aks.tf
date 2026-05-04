resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  dns_prefix          = var.cluster_name
  kubernetes_version  = var.kubernetes_version
  tags                = var.tags

  image_cleaner_enabled        = true
  image_cleaner_interval_hours = 48
  azure_policy_enabled         = true

  # Default NodeImage
  # node_os_upgrade_channel = "NodeImage"

  default_node_pool {
    name           = "system"
    node_count     = var.node_count
    vm_size        = var.vm_size
    vnet_subnet_id = azapi_resource.aks_subnet.id

    upgrade_settings {
      max_surge = "10%"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_policy      = "azure"
    load_balancer_sku   = "standard"
    pod_cidr            = var.pod_cidr
    service_cidr        = var.service_cidr
    dns_service_ip      = var.dns_service_ip
  }

  oidc_issuer_enabled = true

  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count,
      kubernetes_version,
    ]
  }
}

# AKS has two relevant identities:
# - identity[0].principal_id: the cluster control plane identity
# - kubelet_identity[0].object_id: used by the cloud controller manager for LB reconciliation
# Both need Network Contributor on the VNet so the CCM can read/write subnets when
# provisioning internal load balancers. The VNet is in a separate Landing Zone RG.
# resource "azurerm_role_assignment" "aks_network_contributor" {
#   scope                = data.azurerm_virtual_network.main.id
#   role_definition_name = "Network Contributor"
#   principal_id         = azurerm_kubernetes_cluster.main.identity[0].principal_id
# }

# resource "azurerm_role_assignment" "aks_kubelet_network_contributor" {
#   scope                = data.azurerm_virtual_network.main.id
#   role_definition_name = "Network Contributor"
#   principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
# }

