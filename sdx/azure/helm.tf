resource "helm_release" "sdx_edge" {
  name             = var.edge_id
  chart            = "oci://ghcr.io/bcgov/aps-devops/sdx-edge"
  version          = "0.1.0"
  namespace        = var.namespace
  create_namespace = true

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

  # Embed the pre-allocated LB public IP as a SAN on the edge server certificate.
  # The static IP is known before the Kubernetes service is created, avoiding
  # a chicken-and-egg dependency.
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

# L4 LoadBalancer service — TCP traffic reaches Kong unmodified, preserving
# the full mTLS handshake between external clients and Kong.
# Azure attaches the pre-allocated static IP via the azure-pip-name annotation
# so the IP is stable and matches the SAN embedded in the edge TLS cert above.
resource "kubernetes_service_v1" "sdx_edge_lb" {
  metadata {
    name      = "${var.edge_id}-lb"
    namespace = var.namespace

    annotations = {
      # Bind the pre-allocated static public IP to this service
      "service.beta.kubernetes.io/azure-pip-name"                     = azurerm_public_ip.kong_lb.name
      "service.beta.kubernetes.io/azure-load-balancer-resource-group" = azurerm_resource_group.main.name
      # TCP probe on 8443: marks the backend healthy as soon as Kong is listening,
      # without waiting for TLS bootstrap (which can take minutes on first deploy)
      "service.beta.kubernetes.io/azure-load-balancer-health-probe-port"     = "8443"
      "service.beta.kubernetes.io/azure-load-balancer-health-probe-protocol" = "tcp"
    }
  }

  spec {
    type = "LoadBalancer"

    # Select the Kong proxy pods deployed by the helm chart.
    # The instance label is sdx-edge-<release-name> per _helpers.tpl.
    selector = {
      "app.kubernetes.io/name"      = "sdx-edge"
      "app.kubernetes.io/component" = "kong"
      "app.kubernetes.io/instance"  = local.kong_svc_name
    }

    # Port 443 → Kong TLS proxy (8443): carries mTLS client connections
    port {
      name        = "https"
      port        = 443
      target_port = 8443
      protocol    = "TCP"
    }
  }

  depends_on = [helm_release.sdx_edge]
}
