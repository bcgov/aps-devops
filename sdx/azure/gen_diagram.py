"""
SDX Edge Azure Architecture – three diagram views:
  1. sdx_network_view.png   – L3/L4 network topology, subnets, NSGs, traffic paths
  2. sdx_service_view.png   – Logical service interactions and traffic flows
  3. sdx_resource_view.png  – Azure resource hierarchy grouped by resource group

Source of truth: terraform.tfvars + *.tf files in this directory.
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import (
    ContainerInstances,
    ContainerRegistries,
    KubernetesServices,
    VMScaleSets,
)
from diagrams.azure.network import (
    ApplicationGateway,
    CDNProfiles,
    DNSPrivateZones,
    Firewall,
    FrontDoors,
    LoadBalancers,
    NetworkSecurityGroupsClassic,
    PublicIpAddresses,
    Subnets,
    VirtualNetworks,
    VirtualWans,
)
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.general import Resourcegroups
from diagrams.k8s.compute import Job, Pod
from diagrams.k8s.network import Service
from diagrams.onprem.client import Users
from diagrams.onprem.network import Internet

# ── Shared graph/cluster style helpers ───────────────────────────────────────

_BASE_GRAPH = {
    "fontname": "Helvetica",
    "fontsize": "13",
    "bgcolor": "white",
    "pad": "1.0",
    "splines": "ortho",
    "nodesep": "0.6",
    "ranksep": "0.9",
}

_BASE_CLUSTER = {"fontname": "Helvetica Bold", "fontsize": "11"}


def _c(bg, extra=None):
    a = {**_BASE_CLUSTER, "bgcolor": bg, "style": "rounded"}
    if extra:
        a.update(extra)
    return a


def _cd(bg, extra=None):
    a = {**_BASE_CLUSTER, "bgcolor": bg, "style": "dashed"}
    if extra:
        a.update(extra)
    return a


# ─────────────────────────────────────────────────────────────────────────────
# Diagram 1 – Network View
# Shows: VNet topology, subnets + CIDRs, NSGs, IPs, routing, traffic paths
# ─────────────────────────────────────────────────────────────────────────────

def draw_network_view():
    with Diagram(
        "SDX Edge – Network View",
        filename="sdx_network_view",
        outformat="png",
        show=False,
        direction="TB",
        graph_attr=_BASE_GRAPH,
    ):
        internet = Internet("Internet\n(Public Clients)")

        # Azure Front Door is a global service — outside any VNet
        with Cluster("Azure Front Door Premium  (Global CDN / WAF)", graph_attr=_c("#e8eaf6")):
            afd = CDNProfiles("AFD Profile\nsdx-edge-aks-afd\nPremium_AzureFrontDoor")
            afd_ep = FrontDoors("Endpoint\nsdx-edge-aks-ep\n*.z01.azurefd.net")

        with Cluster("BC Gov Azure Landing Zone", graph_attr=_c("#dceefb")):

            with Cluster("Connectivity Subscription  (BC Gov managed)", graph_attr=_c("#c3daf7")):
                vwan = VirtualWans("VWAN Hub\nCanada Central")
                hub_fw = Firewall("Hub Firewall\nEgress control\n(centralized)")
                priv_dns = DNSPrivateZones("Private DNS Zones\ncentralized\n(auto A-record for ACA PE)")

            with Cluster(
                "Workload Subscription  –  Canada Central",
                graph_attr=_c("#e8f5e9"),
            ):
                with Cluster("RG: sdx-edge-rg", graph_attr=_c("#d7f0dd")):

                    # Public entry points
                    kong_pip = PublicIpAddresses(
                        "Kong LB PIP\nsdx-edge-aks-kong-pip\n20.63.99.116  static"
                    )
                    appgw_pip = PublicIpAddresses(
                        "AppGW PIP\nsdx-edge-aks-appgw-pip\nstatic Standard"
                    )

                    # Azure LB (Terraform-managed, fronts Kong NodePort)
                    kong_lb = LoadBalancers(
                        "Azure Standard LB\nsdx-edge-aks-kong-lb\nFrontend :443 → NodePort :30443"
                    )

                    # VNet is provisioned by the Landing Zone — workload only creates subnets
                    with Cluster(
                        "VNet: b9cee3-test-vwan-spoke  (LZ provisioned)\n"
                        "RG: b9cee3-test-networking",
                        graph_attr=_c("#b3d4f5"),
                    ):
                        with Cluster(
                            "appgw-subnet  10.46.8.192/28\n"
                            "NSG: allow GatewayManager, :80/:443 inbound, LB probe",
                            graph_attr=_c("#d0eaff"),
                        ):
                            appgw_nsg = NetworkSecurityGroupsClassic(
                                "NSG\nsdx-edge-aks-appgw-nsg"
                            )
                            appgw = ApplicationGateway(
                                "Application Gateway\nsdx-edge-aks-appgw\nWAF_v2  :80/:443"
                            )

                        with Cluster(
                            "aks-subnet  10.46.8.128/26  ←  Azure CNI overlay\n"
                            "NSG: allow AzureFrontDoor.Backend :30443, appgw-subnet :30443, LB probe",
                            graph_attr=_c("#cce7ff"),
                        ):
                            aks_nsg = NetworkSecurityGroupsClassic(
                                "NSG\nsdx-edge-aks-aks-nsg"
                            )
                            aks = KubernetesServices(
                                "AKS Cluster\nsdx-edge-aks\nAzure CNI overlay\nazure policy enabled"
                            )
                            aks_nodes = VMScaleSets(
                                "VMSS Node Pool\nsystem  2× D2s_v3\n"
                                "pods: 10.10.0.0/18\nsvc: 10.10.64.0/22\nNodePort :30443"
                            )

                        with Cluster(
                            "aca-subnet  10.46.8.224/27\n"
                            "delegated: Microsoft.App/environments\nNSG: allow LB probe",
                            graph_attr=_c("#c8e6c9"),
                        ):
                            aca_nsg = NetworkSecurityGroupsClassic(
                                "NSG\nsdx-edge-aks-aca-nsg"
                            )
                            aca_env = ContainerInstances(
                                "Container App Env\nsdx-edge-aks-cae\nConsumption\npublic access: Disabled"
                            )

        # ── Traffic flows ─────────────────────────────────────────────────────

        # Client → AFD
        internet >> Edge(label="HTTPS :443", color="#1565C0", style="bold") >> afd
        afd >> afd_ep

        # AFD → Kong LB (/* route — planned)
        afd_ep >> Edge(
            label="/* route\nHTTPS :443\nsrc tag: AzureFrontDoor.Backend",
            color="#1565C0",
        ) >> kong_pip
        kong_pip >> kong_lb
        kong_lb >> Edge(label="TCP :443 → :30443", color="#1565C0") >> aks_nodes

        # AFD → Container App (/hello route)
        afd_ep >> Edge(
            label="/hello, /hello/*\nHTTPS :443",
            color="#43a047",
            style="dashed",
        ) >> aca_env

        # Internet → AppGW (direct / BC Gov internal)
        internet >> Edge(
            label="HTTPS :443 / HTTP :80\n(direct / BC Gov internal)",
            color="#e65100",
        ) >> appgw_pip
        appgw_pip >> appgw
        appgw >> Edge(
            label="HTTPS :30443\n(node private IPs\nNSG: appgw-subnet CIDR)",
            color="#e65100",
        ) >> aks_nodes

        # AKS outbound via VWAN hub
        aks_nodes >> Edge(
            label="outbound (VWAN hub → firewall)",
            color="#9e9e9e",
            style="dashed",
        ) >> vwan
        vwan >> hub_fw

        # ACA outbound
        aca_env >> Edge(color="#9e9e9e", style="dashed") >> vwan

        # Private DNS → ACA (auto A-record)
        priv_dns >> Edge(
            label="auto A-record\n(~10 min after PE)",
            color="#9e9e9e",
            style="dashed",
        ) >> aca_env


# ─────────────────────────────────────────────────────────────────────────────
# Diagram 2 – Logical Service View
# Shows: service interactions, traffic flows, mTLS, TLS bootstrap
# ─────────────────────────────────────────────────────────────────────────────

def draw_service_view():
    with Diagram(
        "SDX Edge – Logical Service View",
        filename="sdx_service_view",
        outformat="png",
        show=False,
        direction="LR",
        graph_attr={**_BASE_GRAPH, "splines": "curved", "nodesep": "0.7"},
    ):
        # External clients
        mtls_client = Users("mTLS Clients\n(Internet)")
        bc_internal = Users("BC Gov Internal\nClients")

        # External SDX control plane (on dev.api.gov.bc.ca)
        with Cluster(
            "SDX Control Plane  (dev.api.gov.bc.ca)", graph_attr=_c("#f3e5f5")
        ):
            sdx_ctrl = Internet(
                "SDX Control API\nsdx-cluster-api-gov-bc-ca\n:443"
            )
            sdx_ca = Internet(
                "SDX CA\nsdx-ca-api-gov-bc-ca\nhttps"
            )
            sdx_agg = Internet(
                "SDX Aggregator\ngwaggregator-api-gov-bc-ca\n:443"
            )

        with Cluster("Azure – Canada Central", graph_attr=_c("#f1f8e9")):

            # Global edge / WAF
            with Cluster(
                "Global Edge & WAF  (Azure Front Door Premium)",
                graph_attr=_c("#e8eaf6"),
            ):
                afd = CDNProfiles(
                    "Azure Front Door\nsdx-edge-aks-afd\nPremium + WAF (planned)"
                )
                afd_ep = FrontDoors(
                    "AFD Endpoint\nsdx-edge-aks-ep"
                )
                afd >> afd_ep

            # Ingress / gateway layer
            with Cluster("Ingress Layer", graph_attr=_c("#e3f2fd")):
                appgw = ApplicationGateway(
                    "Application Gateway\nsdx-edge-aks-appgw\nWAF_v2  :80/:443"
                )
                kong_lb = LoadBalancers(
                    "Azure Standard LB\nsdx-edge-aks-kong-lb\nPublic 20.63.99.116\n:443 → :30443"
                )

            # AKS / Kong
            with Cluster(
                "AKS Cluster: sdx-edge-aks  (2× Standard_D2s_v3)",
                graph_attr=_c("#e8f5e9"),
            ):
                with Cluster("Namespace: sdx-edge", graph_attr=_c("#fff8e1")):
                    np_svc = Service(
                        "NodePort: azure01-lb\n:443 / nodePort :30443\ntarget :8443"
                    )
                    with Cluster(
                        "Helm Release: azure01  (sdx-edge chart)",
                        graph_attr=_c("#fce4ec"),
                    ):
                        kong = Pod(
                            "Kong Proxy Pod\nmTLS :8443\nroute host: azure01.servers.sdx"
                        )
                    init_job = Job("Init Job\nTLS Bootstrap\n(one-time token → signed cert)")

            # Container Apps
            with Cluster("Container Apps", graph_attr=_c("#e0f2f1")):
                acr = ContainerRegistries(
                    "ACR\nacrmyapp\nBasic SKU"
                )
                hello_app = ContainerInstances(
                    "hello  Container App\nsdx-edge-aks-hello\nport 8000\n0.25 vCPU / 0.5 GiB"
                )

        # ── Service-level flows ───────────────────────────────────────────────

        # mTLS clients → AFD → Kong LB → Kong pod
        mtls_client >> Edge(
            label="mTLS HTTPS :443", color="#1565C0", style="bold"
        ) >> afd_ep
        afd_ep >> Edge(
            label="/* (future Kong route)", color="#1565C0"
        ) >> kong_lb
        kong_lb >> Edge(label="NodePort :30443", color="#1565C0") >> np_svc
        np_svc >> Edge(label="mTLS :8443", color="#1565C0", style="bold") >> kong

        # AFD → hello app
        afd_ep >> Edge(
            label="/hello, /hello/*\nHTTPS :443", color="#43a047"
        ) >> hello_app
        acr >> Edge(
            label="image pull\n(admin creds)", color="#757575", style="dashed"
        ) >> hello_app

        # BC Gov internal → AppGW → Kong (bypass AFD)
        bc_internal >> Edge(label="HTTPS :443 / HTTP :80", color="#e65100") >> appgw
        appgw >> Edge(
            label="HTTPS :30443\n(node private IPs)", color="#e65100"
        ) >> kong

        # Kong → SDX control plane (outbound mTLS)
        kong >> Edge(
            label="mTLS :443\ncontrol channel", color="#2e7d32", style="dashed"
        ) >> sdx_ctrl
        kong >> Edge(
            label="aggregator :443", color="#2e7d32", style="dashed"
        ) >> sdx_agg

        # TLS bootstrap flow (one-time at pod start)
        init_job >> Edge(
            label="CSR + bootstrap token\n(one-time)", color="#6a1b9a", style="dashed"
        ) >> sdx_ca
        sdx_ca >> Edge(
            label="signed cert → mounted\nas pod TLS secret", color="#6a1b9a", style="dashed"
        ) >> kong


# ─────────────────────────────────────────────────────────────────────────────
# Diagram 3 – Resource View
# Shows: Azure resource hierarchy grouped by subscription / resource group
# ─────────────────────────────────────────────────────────────────────────────

def draw_resource_view():
    with Diagram(
        "SDX Edge – Resource View",
        filename="sdx_resource_view",
        outformat="png",
        show=False,
        direction="TB",
        graph_attr={**_BASE_GRAPH, "ranksep": "1.1", "nodesep": "0.7"},
    ):
        with Cluster(
            "Azure Subscription  (BC Gov workload)", graph_attr=_c("#f5f5f5")
        ):

            # ── Global AFD resources ─────────────────────────────────────────
            with Cluster(
                "Azure Front Door  (Global – no region)", graph_attr=_c("#e8eaf6")
            ):
                afd_profile = CDNProfiles(
                    "AFD Profile\nsdx-edge-aks-afd\nPremium_AzureFrontDoor"
                )
                afd_ep = FrontDoors("AFD Endpoint\nsdx-edge-aks-ep")
                afd_og = CDNProfiles("Origin Group\nhello\nHTTPS health probe")
                afd_origin = FrontDoors(
                    "AFD Origin\nhello\nhost: hello.azurecontainerapps.io"
                )
                afd_route = FrontDoors(
                    "AFD Route\nhello\n/hello, /hello/*\nHttpsOnly"
                )

            # ── Landing Zone networking RG ───────────────────────────────────
            with Cluster(
                "RG: b9cee3-test-networking  (BC Gov Landing Zone managed)",
                graph_attr=_c("#dceefb"),
            ):
                vnet = VirtualNetworks(
                    "VNet\nb9cee3-test-vwan-spoke\n(VWAN spoke)"
                )
                vwan = VirtualWans("VWAN Hub\n(BC Gov managed)")
                priv_dns = DNSPrivateZones(
                    "Private DNS Zones\ncentralized"
                )

            # ── Workload RG ──────────────────────────────────────────────────
            with Cluster(
                "RG: sdx-edge-rg  (Canada Central  –  Terraform managed)",
                graph_attr=_c("#e8f5e9"),
            ):

                with Cluster("Public IPs & Load Balancing", graph_attr=_c("#e3f2fd")):
                    kong_pip = PublicIpAddresses(
                        "Public IP\nsdx-edge-aks-kong-pip\n20.63.99.116\ndomain: sdx-edge-aks-kong"
                    )
                    appgw_pip = PublicIpAddresses(
                        "Public IP\nsdx-edge-aks-appgw-pip\nstatic Standard"
                    )
                    kong_lb = LoadBalancers(
                        "Azure Standard LB\nsdx-edge-aks-kong-lb\nFE :443 → BE :30443\nprobe: TCP :30443"
                    )
                    appgw = ApplicationGateway(
                        "Application Gateway\nsdx-edge-aks-appgw\nWAF_v2  1 instance\nOWASP 3.2 / Prevention\ntrustedRoot: SDX CA"
                    )

                with Cluster(
                    "Subnets  (created in LZ VNet via azapi)", graph_attr=_c("#d0eaff")
                ):
                    aks_subnet = Subnets(
                        "aks-subnet\n10.46.8.128/26\ndefaultOutboundAccess: false"
                    )
                    appgw_subnet = Subnets(
                        "appgw-subnet\n10.46.8.192/28\ndefaultOutboundAccess: false"
                    )
                    aca_subnet = Subnets(
                        "aca-subnet\n10.46.8.224/27\ndelegated: App/environments\ndefaultOutboundAccess: false"
                    )

                with Cluster("Network Security Groups", graph_attr=_c("#e3f2fd")):
                    aks_nsg = NetworkSecurityGroupsClassic(
                        "NSG: aks-nsg\n→ allow AFD.Backend :30443\n→ allow appgw-cidr :30443\n→ allow AzureLB probe"
                    )
                    appgw_nsg = NetworkSecurityGroupsClassic(
                        "NSG: appgw-nsg\n→ allow GatewayManager 65200-65535\n→ allow Internet :443\n→ allow Internet :80\n→ allow AzureLB probe"
                    )
                    aca_nsg = NetworkSecurityGroupsClassic(
                        "NSG: aca-nsg\n→ allow AzureLB probe"
                    )

                with Cluster("Compute", graph_attr=_c("#e8f5e9")):
                    aks = KubernetesServices(
                        "AKS Cluster\nsdx-edge-aks\nAzure CNI overlay\npod CIDR: 10.10.0.0/18\nsvc CIDR: 10.10.64.0/22\nazure policy enabled"
                    )
                    acr = ContainerRegistries(
                        "ACR\nacrmyapp\nBasic SKU\nadmin enabled"
                    )
                    aca_env = ContainerInstances(
                        "Container App Env\nsdx-edge-aks-cae\nConsumption\npublic access: Disabled"
                    )
                    hello_app = ContainerInstances(
                        "Container App\nsdx-edge-aks-hello\n0.25 vCPU / 0.5 GiB\ningress: external :8000"
                    )

                with Cluster("Identity", graph_attr=_c("#fff3e0")):
                    mi = ManagedIdentities(
                        "System-Assigned MI\n(AKS cluster identity)\nNetwork Contributor (planned)"
                    )

            # ── Auto-managed RGs ─────────────────────────────────────────────
            with Cluster(
                "RG: MC_sdx-edge-rg_sdx-edge-aks_canadacentral  (AKS node pool – auto-managed)",
                graph_attr=_cd("#fafafa"),
            ):
                vmss = VMScaleSets(
                    "VMSS: system node pool\n2× Standard_D2s_v3\nNodePort :30443 exposed"
                )

            with Cluster(
                "RG: sdx-edge-aks-cae-infra-rg  (ACA infrastructure – auto-managed)",
                graph_attr=_cd("#fafafa"),
            ):
                aca_infra = ContainerInstances("ACA Infra Resources\n(Azure managed)")

            # ── Kubernetes resources ─────────────────────────────────────────
            with Cluster(
                "Kubernetes  /  cluster: sdx-edge-aks  /  ns: sdx-edge",
                graph_attr=_c("#fff8e1"),
            ):
                helm_rel = Pod(
                    "Helm Release: azure01\nchart: oci://ghcr.io/bcgov/aps-devops/sdx-edge\nv0.1.0"
                )
                np_svc = Service(
                    "NodePort: azure01-lb\n:443/nodePort :30443 → :8443"
                )
                init_j = Job("Init Job\nTLS Bootstrap\nCSR → CA → signed cert")

        # ── Resource relationships ────────────────────────────────────────────

        # AFD hierarchy
        afd_profile >> afd_ep
        afd_profile >> afd_og >> afd_origin >> afd_route

        # VNet ← VWAN peering
        vnet >> Edge(label="VWAN spoke peering", style="dashed") >> vwan

        # Subnets in VNet
        vnet >> aks_subnet
        vnet >> appgw_subnet
        vnet >> aca_subnet

        # NSG associations
        aks_nsg >> aks_subnet
        appgw_nsg >> appgw_subnet
        aca_nsg >> aca_subnet

        # PIPs → gateways
        kong_pip >> kong_lb
        appgw_pip >> appgw

        # Subnets → resources
        appgw_subnet >> appgw
        aks_subnet >> aks
        aca_subnet >> aca_env

        # AKS → VMSS node pool
        aks >> vmss
        mi >> Edge(label="system-assigned", style="dashed") >> aks

        # ACA → infra RG
        aca_env >> aca_infra
        aca_env >> hello_app
        acr >> Edge(label="image pull") >> hello_app

        # Kong LB → AKS nodes
        kong_lb >> Edge(label="→ NodePort :30443") >> vmss

        # AppGW → AKS nodes
        appgw >> Edge(label="→ NodePort :30443\n(node IPs via local-exec)") >> vmss

        # Kubernetes resources
        aks >> helm_rel
        helm_rel >> np_svc
        helm_rel >> init_j

        # AFD origins
        afd_origin >> Edge(label="origin", style="dashed") >> hello_app
        afd_ep >> Edge(label="/* (future)", style="dashed") >> kong_pip

        # Private DNS → ACA
        priv_dns >> Edge(
            label="auto A-record\n(~10 min)", style="dashed", color="#9e9e9e"
        ) >> aca_env


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Generating network view...")
    draw_network_view()
    print("  → sdx_network_view.png")

    print("Generating service view...")
    draw_service_view()
    print("  → sdx_service_view.png")

    print("Generating resource view...")
    draw_resource_view()
    print("  → sdx_resource_view.png")

    print("\nDone. Three diagrams written.")
