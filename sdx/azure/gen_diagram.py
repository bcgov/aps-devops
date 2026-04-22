"""
SDX Edge AKS Architecture Diagram
VNet + subnet layout with ingress flow down to pod-level detail
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import KubernetesServices
from diagrams.azure.network import (
    PublicIpAddresses,
    VirtualNetworks,
    LoadBalancers,
    NetworkSecurityGroupsClassic,
    Subnets,
)
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.general import Resourcegroups
from diagrams.k8s.compute import Pod, Job
from diagrams.k8s.network import Service
from diagrams.onprem.client import Users
from diagrams.onprem.network import Internet

graph_attr = {
    "fontsize": "13",
    "bgcolor": "white",
    "pad": "0.8",
    "splines": "ortho",
    "nodesep": "0.5",
    "ranksep": "0.7",
    "fontname": "Helvetica",
}

cluster_attr = {
    "fontsize": "12",
    "fontname": "Helvetica Bold",
}

with Diagram(
    "SDX Edge – Azure AKS Architecture",
    filename="sdx_edge_architecture",
    outformat="png",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
):
    # ── External actors ───────────────────────────────────────────────────────
    client = Users("mTLS Clients\n(Internet)")

    with Cluster("External SDX Control Plane (dev.api.gov.bc.ca)", graph_attr=cluster_attr):
        sdx_ctrl = Internet("SDX Control API\n:443")
        sdx_ca = Internet("Certificate Authority\nsdx-ca-api")
        sdx_agg = Internet("Aggregator\ngwaggregator")

    # ── Azure subscription boundary ───────────────────────────────────────────
    with Cluster("Azure – Canada Central", graph_attr=cluster_attr):

        rg = Resourcegroups("Resource Group\nsdx-edge-rg")

        # ── Network layer ────────────────────────────────────────────────────
        pip = PublicIpAddresses(
            "Public IP (Static)\nsdx-edge-aks-kong-lb-pip\nport 443"
        )
        nsg = NetworkSecurityGroupsClassic(
            "NSG: sdx-edge-aks-nsg\nAllow TCP 443 (Internet→)\nAllow TCP 80 (Internet→)\nAllow AzureLoadBalancer"
        )
        alb = LoadBalancers(
            "Azure Standard\nLoad Balancer\nHealth probe: TCP 8443"
        )

        mi = ManagedIdentities(
            "System-Assigned\nManaged Identity\nRole: Network Contributor"
        )

        # ── VNet ─────────────────────────────────────────────────────────────
        with Cluster(
            "Virtual Network: sdx-edge-aks-vnet  (10.0.0.0/8)",
            graph_attr={**cluster_attr, "bgcolor": "#e8f4fd", "style": "rounded"},
        ):
            with Cluster(
                "Subnet: aks-subnet  (10.240.0.0/16)  ← Azure CNI",
                graph_attr={**cluster_attr, "bgcolor": "#d0eaff", "style": "rounded"},
            ):

                aks = KubernetesServices(
                    "AKS Cluster\nsdx-edge-aks\n2× Standard_D2s_v3\n(system node pool)"
                )

                # ── Kubernetes namespace ──────────────────────────────────────
                with Cluster(
                    "Namespace: sdx-edge",
                    graph_attr={
                        **cluster_attr,
                        "bgcolor": "#fff8e1",
                        "style": "rounded",
                    },
                ):
                    svc_lb = Service(
                        "Service (LoadBalancer)\nmy-edge-lb\n443 → 8443"
                    )

                    with Cluster(
                        "Kong Proxy Deployment",
                        graph_attr={
                            **cluster_attr,
                            "bgcolor": "#fce4ec",
                            "style": "rounded",
                        },
                    ):
                        kong_pod = Pod(
                            "Kong Proxy Pod\nport 8443 (TLS)\nmTLS enforced"
                        )

                    init_job = Job(
                        "Init Job\nTLS Bootstrap\n(one-time token → CA cert)"
                    )

    # ── Ingress flow (left-to-right / top-to-bottom) ──────────────────────────
    client >> Edge(label="HTTPS :443\nmTLS", color="#1565C0", style="bold") >> pip
    pip >> Edge(label="TCP :443", color="#1565C0") >> nsg
    nsg >> Edge(color="#1565C0") >> alb
    alb >> Edge(label="TCP :443→8443\nhealth probe :8443", color="#1565C0") >> svc_lb
    svc_lb >> Edge(label="TCP :8443", color="#1565C0", style="bold") >> kong_pod

    # TLS bootstrap flow
    init_job >> Edge(label="CSR + token", color="#6a1b9a", style="dashed") >> sdx_ca
    sdx_ca >> Edge(label="signed cert (mounted TLS)", color="#6a1b9a", style="dashed") >> kong_pod

    # Kong upstream connections
    kong_pod >> Edge(label="control channel\nmTLS :443", color="#2e7d32", style="dashed") >> sdx_ctrl
    kong_pod >> Edge(label="aggregator", color="#2e7d32", style="dashed") >> sdx_agg

    # AKS uses managed identity
    mi >> Edge(label="Network Contributor\n(manage LB + IP)", color="#e65100", style="dashed") >> alb
    mi >> Edge(color="#e65100", style="dashed") >> pip


print("Diagram written to sdx_edge_architecture.png")
