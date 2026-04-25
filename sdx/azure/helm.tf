resource "helm_release" "sdx_edge" {
  name             = var.edge_id
  chart            = "oci://ghcr.io/bcgov/aps-devops/sdx-edge"
  version          = "0.1.0"
  namespace        = var.namespace
  create_namespace = true

  timeout = 60

  # Core connectivity
  set {
    name  = "sdx_control_url"
    value = var.sdx_control_url
  }

  set {
    name  = "client_ca_url"
    value = var.client_ca_url
  }

  set {
    name  = "sdx_aggregator_url"
    value = var.sdx_aggregator_url
  }

  # Route host used by Kong for virtual host matching
  set {
    name  = "route.host"
    value = local.edge_domain
  }

  # mTLS settings
  set {
    name  = "mtls_required"
    value = tostring(var.mtls_required)
  }

  # TLS bootstrap — one-time token consumed by the init job to obtain certs
  set_sensitive {
    name  = "tls.client.bootstrap.token"
    value = var.sdx_bootstrap_token
  }

  set {
    name  = "tls.client.cn"
    value = local.edge_domain
  }

  # Embed the public LB IP as a SAN on the server cert
  set {
    name  = "tls.server.ip"
    value = azurerm_public_ip.kong_lb.ip_address
  }

  set {
    name  = "https_proxy"
    value = var.https_proxy
  }

  set {
    name  = "use_openshift_resources"
    value = "false"
  }

  depends_on = [azurerm_kubernetes_cluster.main]
}

# NodePort service — the Terraform-managed Azure public LB (lb.tf) routes traffic
# from azurerm_public_ip.kong_lb:443 to this fixed NodePort on each node, bypassing
# the AKS cloud controller manager entirely (no VNet subnet permissions needed).
resource "kubernetes_service_v1" "sdx_edge_lb" {
  metadata {
    name      = "${var.edge_id}-lb"
    namespace = var.namespace
  }

  spec {
    type = "NodePort"

    selector = {
      "app.kubernetes.io/name"      = "sdx-edge"
      "app.kubernetes.io/component" = "kong"
      "app.kubernetes.io/instance"  = local.kong_svc_name
    }

    port {
      name        = "https"
      port        = 443
      target_port = 8443
      node_port   = var.kong_node_port
      protocol    = "TCP"
    }
  }

  depends_on = [helm_release.sdx_edge]
}
