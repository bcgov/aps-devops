module "sdx_edge_infra" {
  source = "./sdx_edge_infra"

  resource_group_name      = var.resource_group_name
  location                 = var.location
  tags                     = var.tags
  vnet_name                = var.vnet_name
  vnet_resource_group_name = var.vnet_resource_group_name
  cluster_name             = var.cluster_name
  kubernetes_version       = var.kubernetes_version
  node_count               = var.node_count
  vm_size                  = var.vm_size
  aks_subnet_cidr          = var.aks_subnet_cidr
  appgw_subnet_cidr        = var.appgw_subnet_cidr
  appgw_sku                = var.appgw_sku
  appgw_capacity           = var.appgw_capacity
  pod_cidr                 = var.pod_cidr
  service_cidr             = var.service_cidr
  dns_service_ip           = var.dns_service_ip
  kong_node_port           = var.kong_node_port
}

module "sdx_edge_server" {
  source = "./sdx_edge_server"

  edge_id             = var.edge_id
  namespace           = var.namespace
  chart_version       = var.sdx_edge_chart_version
  sdx_bootstrap_token = var.sdx_bootstrap_token
  sdx_control_url     = var.sdx_control_url
  client_ca_url       = var.client_ca_url
  sdx_aggregator_url  = var.sdx_aggregator_url
  mtls_required       = var.mtls_required
  https_proxy         = var.https_proxy
  kong_node_port      = var.kong_node_port
  appgw_public_ip     = module.sdx_edge_infra.appgw_public_ip

  depends_on = [module.sdx_edge_infra]
}

module "app_showme" {
  source = "./app_showme"

  cluster_name             = var.cluster_name
  tags                     = var.tags
  vnet_name                = var.vnet_name
  vnet_resource_group_name = var.vnet_resource_group_name
  aca_subnet_cidr          = var.aca_subnet_cidr
  resource_group_id        = module.sdx_edge_infra.resource_group_id
  resource_group_name      = module.sdx_edge_infra.resource_group_name
  resource_group_location  = module.sdx_edge_infra.resource_group_location
  aks_subnet_id            = module.sdx_edge_infra.aks_subnet_id

  depends_on = [module.sdx_edge_infra]
}
