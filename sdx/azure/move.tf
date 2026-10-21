moved {
  from = azurerm_public_ip.appgw
  to   = module.sdx_edge_infra.azurerm_public_ip.appgw
}

moved {
  from = azurerm_web_application_firewall_policy.appgw
  to   = module.sdx_edge_infra.azurerm_web_application_firewall_policy.appgw
}


moved {
  from = azapi_resource.appgw
  to   = module.sdx_edge_infra.azapi_resource.appgw
}

moved {
  from = terraform_data.appgw_backends
  to   = module.sdx_edge_infra.terraform_data.appgw_backends
}

moved {
  from = azurerm_kubernetes_cluster.main
  to   = module.sdx_edge_infra.azurerm_kubernetes_cluster.main
}

moved {
  from = azurerm_resource_group.main
  to   = module.sdx_edge_infra.azurerm_resource_group.main
}


# NETWORK

moved {
  from = azurerm_network_security_group.aks
  to   = module.sdx_edge_infra.azurerm_network_security_group.aks
}

moved {
  from = azapi_resource.aks_subnet
  to   = module.sdx_edge_infra.azapi_resource.aks_subnet
}

moved {
  from = azurerm_network_security_group.appgw
  to   = module.sdx_edge_infra.azurerm_network_security_group.appgw
}

moved {
  from = azapi_resource.appgw_subnet
  to   = module.sdx_edge_infra.azapi_resource.appgw_subnet
}

########### Server

moved {
  from = helm_release.sdx_edge
  to   = module.sdx_edge_server.helm_release.sdx_edge
}

moved {
  from = kubernetes_service_v1.sdx_edge_lb
  to   = module.sdx_edge_server.kubernetes_service_v1.sdx_edge_lb
}

########### ShowMe App

moved {
  from = azurerm_network_security_group.aca
  to   = module.app_showme.azurerm_network_security_group.aca
}

moved {
  from = azapi_resource.aca_subnet
  to   = module.app_showme.azapi_resource.aca_subnet
}

moved {
  from = azapi_resource.aca_environment
  to   = module.app_showme.azapi_resource.aca_environment
}

moved {
  from = azurerm_private_endpoint.aca
  to   = module.app_showme.azurerm_private_endpoint.aca
}

moved {
  from = azurerm_container_app.showme
  to   = module.app_showme.azurerm_container_app.showme
}

moved {
  from = azurerm_container_registry.acr
  to   = module.app_showme.azurerm_container_registry.acr
}
