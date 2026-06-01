resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  dns_prefix          = var.cluster_name
  kubernetes_version  = var.kubernetes_version
  tags                = var.tags

  # private_cluster_enabled             = true
  # private_dns_zone_id                 = var.private_dns_zone_id
  # private_cluster_public_fqdn_enabled = false

  image_cleaner_enabled        = true
  image_cleaner_interval_hours = 48
  azure_policy_enabled         = true

  # Require Entra ID sign-in; no static local cluster-admin kubeconfig.
  # Depends on the azure_active_directory_role_based_access_control block below —
  # admin_group_object_ids must be set or you will be locked out.
  local_account_disabled = true

  # OIDC issuer + Workload Identity so pods federate to Entra ID without stored secrets.
  workload_identity_enabled = true

  # Key Vault CSI driver (Secrets Store) for secret handling.
  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }

  # Entra ID authentication via AKS-managed AAD, with Azure RBAC for Kubernetes authorization.
  azure_active_directory_role_based_access_control {
    tenant_id              = var.tenant_id
    admin_group_object_ids = var.admin_group_object_ids
    azure_rbac_enabled     = true
  }

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
    # Cilium dataplane: eBPF-based policy enforcement and network visibility.
    network_data_plane = "cilium"
    network_policy     = "cilium"
    load_balancer_sku  = "standard"
    pod_cidr           = var.pod_cidr
    service_cidr       = var.service_cidr
    dns_service_ip     = var.dns_service_ip

    # Advanced Container Networking Services (ACNS): observability + security
    # (FQDN/L7 policies, micro-segmentation). Requires the Cilium dataplane.
    advanced_networking {
      observability_enabled = true
      security_enabled      = true
    }
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

