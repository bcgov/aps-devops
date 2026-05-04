# SDX Edge — Azure Terraform

Deploys a BC Gov Landing Zone-compliant SDX Edge gateway on Azure. The gateway uses an Application Gateway (WAF_v2 SKU, required by Landing Zone policy) configured purely as an L4 TCP passthrough — WAF inspection is not active because TCP listeners bypass the WAF engine. End-to-end mTLS is preserved from client to Kong, which terminates TLS and validates client certificates.

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────┐
│  Azure Application       │  WAF_v2 SKU (required by Landing Zone policy)
│  Gateway (public IP)     │  L4 TCP passthrough, port 443 — WAF not active*
└────────────┬────────────┘
             │ TCP :443
             ▼
┌─────────────────────────┐
│  AKS Node Pool          │  NodePort 30443
│  (Kong container)       │  Kong terminates mTLS, validates client certs
└────────────┬────────────┘
             │ mTLS :8443
             ▼
         SDX Aggregator / Control Plane
         (BC Gov API Platform)
```

The Application Gateway backend pool is populated at apply time via a `local-exec` provisioner that queries the AKS VMSS for current node IPs. Re-run `terraform apply` after node scaling or upgrades to refresh the pool.

> **WAF note:** The WAF_v2 SKU is provisioned because BC Gov Landing Zone policy requires it, but the WAF engine does not inspect traffic. TCP listeners (used for L4 passthrough) are not processed by the WAF rule set — only HTTP/HTTPS listeners are. mTLS enforcement is handled entirely by Kong.

### Module layout

```
azure/
├── main.tf                  # Module wiring
├── variables.tf             # Root-level inputs
├── outputs.tf               # Root-level outputs
├── providers.tf             # Provider declarations
├── move.tf                  # Terraform state migration blocks
├── terraform.tfvars.example # Variable template
│
├── sdx_edge_infra/          # AKS cluster, subnets, NSGs, Application Gateway
├── sdx_edge_server/         # sdx-edge Helm chart + Kong NodePort service
└── app_showme/              # Sample Container App (ACR + ACA environment + showme app)
```

### Networking constraints (BC Gov Landing Zone)

The VNet is **pre-provisioned** by the BC Gov Landing Zone — teams cannot create VNets. All subnets must be carved from the VNet address space allocated to your Project Set. NSGs are created atomically with their subnets using `azapi_resource` to satisfy the Landing Zone policy that blocks subnet creation without an NSG.

Private DNS resolution for the Container App private endpoint is managed by the central connectivity subscription — no `private_dns_zone_group` block is needed and the record appears within ~10 minutes of endpoint creation.

#### Application Gateway UDR (service request required)

The Application Gateway subnet requires a User Defined Route (UDR) to reach the internet. This **cannot be done via Terraform** — it requires a service request to the BC Gov platform services team.

The platform team will create a route table attached to the `appgw-subnet` with the following routes:

| Route name | Address prefix | Next hop |
|------------|---------------|----------|
| `default-internet` | `0.0.0.0/0` | Internet |
| `bcgov-internal` | `142.34.0.0/16` | Internet |

Without these routes, AppGW cannot reach its public IP for management traffic and inbound HTTPS will time out. Raise the ticket **before** running `terraform apply` so the UDR is in place by the time the gateway comes up.

The UDR request should specify:
- **Subscription:** your Project Set subscription ID
- **Resource group:** the resource group containing the AppGW (e.g. `sdx-edge-rg`)
- **VNet / subnet:** `<vnet-name>/appgw-subnet`
- **UDR name:** `<cluster_name>-appgw-udr` (e.g. `sdx-edge-aks-appgw-udr`)
- **Routes:** as shown in the table above

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Terraform | >= 1.5 |
| Azure CLI (`az`) | Current stable |
| Helm | >= 3 (used by Terraform provider, not directly) |
| `kubectl` | Current stable (for post-deploy verification) |

You must be authenticated to Azure before running Terraform:

```bash
az login
az account set --subscription <subscription-id>
```

The service principal or user identity running Terraform requires:
- **Contributor** on the target subscription (or resource group scope after creation)
- **Network Contributor** on the Landing Zone VNet resource group (to create subnets)

---

## Quick start

```bash
# 1. Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 2. Initialise providers
terraform init

# 3. Review the plan
terraform plan

# 4. Deploy (~15–20 minutes)
terraform apply

# 5. Configure kubectl
$(terraform output -raw aks_get_credentials)
```

---

## Variables

### Azure placement

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `resource_group_name` | string | `"sdx-edge-rg"` | Name of the resource group to create |
| `location` | string | `"canadacentral"` | Azure region |
| `tags` | map(string) | `{project="sdx-edge", managed_by="terraform"}` | Tags applied to all resources |

### Landing Zone VNet

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `vnet_name` | string | — | Name of the pre-provisioned Landing Zone VNet |
| `vnet_resource_group_name` | string | — | Resource group containing the Landing Zone VNet |

### AKS cluster

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `cluster_name` | string | `"sdx-edge-aks"` | AKS cluster name, also used as resource prefix |
| `node_count` | number | `2` | Initial node pool size |
| `vm_size` | string | `"Standard_D2s_v3"` | Node VM size |
| `kubernetes_version` | string | `null` | Kubernetes version (`null` = latest stable) |

### SDX Edge identity

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `edge_id` | string | `"my-edge"` | Edge identifier; becomes the Helm release name and the virtual hostname `<edge_id>.servers.sdx` |
| `namespace` | string | `"sdx-edge"` | Kubernetes namespace for the Helm release |
| `sdx_bootstrap_token` | string | — | **Sensitive.** One-time token for TLS certificate issuance |

### SDX control plane endpoints

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `sdx_control_url` | string | `"sdx-cluster-api-gov-bc-ca.dev.api.gov.bc.ca:443"` | Control plane host:port |
| `client_ca_url` | string | `"https://sdx-ca-api-gov-bc-ca.dev.api.gov.bc.ca"` | Certificate authority endpoint |
| `sdx_aggregator_url` | string | `"gwaggregator-api-gov-bc-ca.dev.api.gov.bc.ca"` | Aggregator service endpoint |

### Network CIDRs

All CIDRs must fall within the address space of the pre-provisioned Landing Zone VNet and must not overlap each other.

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `aks_subnet_cidr` | string | `"10.46.8.128/26"` | AKS node subnet |
| `appgw_subnet_cidr` | string | `"10.46.8.96/28"` | Application Gateway subnet |
| `aca_subnet_cidr` | string | `"10.46.8.192/27"` | Container App Environment subnet — /27 minimum |
| `pod_cidr` | string | `"10.10.0.0/18"` | Azure CNI Overlay pod CIDR — BC Gov approved range |
| `service_cidr` | string | `"10.10.64.0/22"` | Kubernetes service CIDR — BC Gov approved range |
| `dns_service_ip` | string | `"10.10.64.10"` | Kubernetes DNS IP — must be within `service_cidr` |

### Application Gateway

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `appgw_sku` | string | `"WAF_v2"` | SKU — `WAF_v2` required by BC Gov Landing Zone policy; WAF inspection is not active (TCP listeners bypass the WAF engine) |
| `appgw_capacity` | number | `1` | Instance count |

### Kong / mTLS

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `kong_node_port` | number | `30443` | Kubernetes NodePort for Kong HTTPS (30000–32767) |
| `mtls_required` | bool | `true` | Enforce mutual TLS on client connections |
| `https_proxy` | string | `""` | Outbound HTTP proxy URL (empty = disabled) |

---

## Outputs

| Name | Description |
|------|-------------|
| `resource_group_name` | Resource group containing all deployed resources |
| `aks_cluster_name` | AKS cluster name |
| `aks_get_credentials` | `az aks get-credentials` command to configure `kubectl` |
| `appgw_public_ip` | Application Gateway public IP (L4 TCP passthrough entry point; WAF not active) |
| `edge_domain` | SDX Edge virtual hostname (`<edge_id>.servers.sdx`) |
| `helm_release_status` | Status of the sdx-edge Helm release |
| `acr_login_server` | Container Registry hostname for the ShowMe app |
| `aca_default_domain` | Container App Environment default domain |

---

## Modules

### `sdx_edge_infra`

Provisions the shared infrastructure: resource group, AKS cluster, subnets with NSGs, and the Application Gateway (WAF_v2 SKU). The gateway is configured as a pure L4 TCP passthrough — no WAF policy is attached and no HTTP/HTTPS listeners are created, so the WAF engine is not invoked.

The Application Gateway is created via `azapi_resource` rather than `azurerm_application_gateway` because the azurerm provider does not support the TCP protocol listener type required for L4 passthrough.

After cluster creation a `local-exec` provisioner queries the AKS VMSS and populates the AppGW backend pool with node private IPs. Re-run `terraform apply` after any node pool change.

### `sdx_edge_server`

Deploys the `oci://ghcr.io/bcgov/aps-devops/sdx-edge` Helm chart into the AKS cluster and creates a NodePort service that maps port 443 → container port 8443 at NodePort 30443. The Helm values embed the AppGW public IP as a SAN on the Kong TLS certificate so that connections from the AppGW backend pass certificate validation.

### `app_showme`

Deploys a sample Container App to demonstrate Landing Zone-compliant ACA deployment. See [`app_showme/README.md`](app_showme/README.md) for details on the infrastructure and the ShowMe application.

---

## Troubleshooting

**Backend pool is empty after apply**

The `local-exec` provisioner that populates the AppGW backend pool runs as part of `terraform apply`. If the pool is empty after deployment, verify that:
- `az` CLI is authenticated and targeting the correct subscription
- The AKS VMSS exists in the node resource group (`az vmss list --resource-group <node-rg>`)
- Re-run `terraform apply` — the provisioners will re-sync node IPs

**AppGW health probes failing**

Confirm the AKS NSG allows inbound TCP from the AppGW subnet CIDR on NodePort 30443. The NSG rule `allow-appgw-to-kong` covers this but verify the source address prefix matches your `appgw_subnet_cidr`.

**kubectl cannot reach the cluster**

Run `$(terraform output -raw aks_get_credentials)` to refresh credentials. If the cluster uses private API server, ensure you are on an approved network or VPN.

**ACA private endpoint DNS not resolving**

The BC Gov connectivity subscription creates the DNS A record automatically. Wait up to 10 minutes after the private endpoint is provisioned, then verify with `nslookup <aca_default_domain>` from within the VNet.
