output "helm_release_status" {
  description = "Status of the sdx-edge Helm release"
  value       = helm_release.sdx_edge.status
}

output "edge_domain" {
  description = "SDX Edge virtual hostname"
  value       = local.edge_domain
}

output "nodeport_service_name" {
  description = "Name of the Kong NodePort service"
  value       = kubernetes_service_v1.sdx_edge_lb.metadata[0].name
}
