resource "azurerm_public_ip" "kong_lb" {
  name                = "${var.cluster_name}-kong-pip"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = "${var.cluster_name}-kong"
  tags                = var.tags
}

resource "azurerm_lb" "kong" {
  name                = "${var.cluster_name}-kong-lb"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
  tags                = var.tags

  frontend_ip_configuration {
    name                 = "kong-frontend"
    public_ip_address_id = azurerm_public_ip.kong_lb.id
  }
}

resource "azurerm_lb_backend_address_pool" "kong" {
  name            = "kong-nodes"
  loadbalancer_id = azurerm_lb.kong.id
}

resource "azurerm_lb_probe" "kong" {
  name            = "kong-nodeport-tcp"
  loadbalancer_id = azurerm_lb.kong.id
  protocol        = "Tcp"
  port            = var.kong_node_port
}

resource "azurerm_lb_rule" "kong" {
  name                           = "kong-https"
  loadbalancer_id                = azurerm_lb.kong.id
  protocol                       = "Tcp"
  frontend_port                  = 443
  backend_port                   = var.kong_node_port
  frontend_ip_configuration_name = "kong-frontend"
  backend_address_pool_ids       = [azurerm_lb_backend_address_pool.kong.id]
  probe_id                       = azurerm_lb_probe.kong.id
}

# Node IPs are unknown at plan time so for_each cannot be used. Instead, a
# local-exec queries the AKS VMSS for current node IPs at apply time and syncs
# them into the backend pool via az CLI. Re-run "terraform apply" after node
# pool scaling or upgrades to refresh.
resource "terraform_data" "kong_lb_backends" {
  triggers_replace = [
    azurerm_lb_backend_address_pool.kong.id,
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

      # Remove stale backend addresses before re-adding
      EXISTING=$(az network lb address-pool address list \
        --resource-group "${azurerm_resource_group.main.name}" \
        --lb-name "${azurerm_lb.kong.name}" \
        --pool-name "${azurerm_lb_backend_address_pool.kong.name}" \
        --query "[].name" -o tsv 2>/dev/null || true)

      for ADDR in $EXISTING; do
        az network lb address-pool address remove \
          --resource-group "${azurerm_resource_group.main.name}" \
          --lb-name "${azurerm_lb.kong.name}" \
          --pool-name "${azurerm_lb_backend_address_pool.kong.name}" \
          --name "$ADDR"
      done

      NODE_IPS=$(az vmss nic list \
        --resource-group "$NODE_RG" \
        --vmss-name "$VMSS_NAME" \
        --query "[].ipConfigurations[0].privateIPAddress" -o tsv)

      for IP in $NODE_IPS; do
        az network lb address-pool address add \
          --resource-group "${azurerm_resource_group.main.name}" \
          --lb-name "${azurerm_lb.kong.name}" \
          --pool-name "${azurerm_lb_backend_address_pool.kong.name}" \
          --name "node-$(echo $IP | tr '.' '-')" \
          --vnet "${data.azurerm_virtual_network.main.id}" \
          --ip-address "$IP"
      done
    EOT
  }
}
