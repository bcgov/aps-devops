# app_showme

A minimal reference application demonstrating how to deploy a containerised workload to Azure Container Apps within the BC Gov Landing Zone. It provisions the full ACA infrastructure stack and deploys the **ShowMe** service — a small HTTP API that reflects JWT claims from an Authorization header.

## Infrastructure

### Resources created

| Resource | Name pattern | Purpose |
|----------|-------------|---------|
| Azure Container Registry | `acrmyapp` | Stores the ShowMe container image |
| ACA subnet + NSG | `<cluster_name>-aca-snet` | Infrastructure subnet with `Microsoft.App/environments` delegation |
| Container App Environment | `<cluster_name>-cae` | Shared runtime environment (Consumption workload profile) |
| Private Endpoint | `<cluster_name>-aca-pe` | Places ACA environment on the private VNet |
| Container App | `<cluster_name>-showme` | Runs the ShowMe application |

### Network design

```
BC Gov Landing Zone VNet
│
├── AKS subnet (existing)
│   └── Private Endpoint ──────────────────────────────┐
│                                                       │
└── ACA Infrastructure subnet (/27 minimum)            │
    └── Container App Environment (CAE)  ◄─────────────┘
        └── Container App (showme)
```

The Container App Environment is deployed with `publicNetworkAccess: Disabled`. External traffic reaches it exclusively through the private endpoint placed in the AKS subnet. The BC Gov central connectivity subscription resolves the private endpoint DNS A record within ~10 minutes of endpoint creation — no `private_dns_zone_group` block is required.

The ACA subnet requires the `Microsoft.App/environments` service delegation. This is applied atomically with subnet creation using `azapi_resource` to satisfy the Landing Zone policy requiring NSG attachment at creation time.

### Why `azapi_resource` for the CAE

`azurerm_container_app_environment` does not expose `publicNetworkAccess`, which means disabling public access would require a separate patch after creation. Using `azapi_resource` with the ARM API directly sets the property at creation time, avoiding a race condition between the patch and private endpoint provisioning.

---

## ShowMe application

`oci/showme/` contains a single-file Deno HTTP server.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/me` | Returns JWT claims from `Authorization: Bearer <token>`, or `{"user":"anonymous"}` if unauthenticated |

**Unauthenticated:**
```bash
curl https://<aca-domain>/v1/me
# {"user":"anonymous"}
```

**Authenticated:**
```bash
curl -H "Authorization: Bearer <jwt>" https://<aca-domain>/v1/me
# {"sub":"user@example.com","aud":"...","iat":...,"exp":...}
```

The server only decodes the JWT payload — it does **not** verify the signature. This is intentional for a demo app. In production, verification should be performed by Kong or an upstream identity provider before the request reaches the application.

### Runtime

| Property | Value |
|----------|-------|
| Runtime | Deno 2.7.10 |
| Port | 8000 |
| CPU | 0.25 vCPU |
| Memory | 0.5 GiB |
| Replicas | 1 |

---

## Building and pushing the image

### Prerequisites

- Docker
- Azure CLI authenticated (`az login`)
- Terraform applied (ACR must exist before pushing)

### Build and push

```bash
# Get the ACR hostname from Terraform output
ACR=$(terraform -chdir=.. output -raw acr_login_server)

# Authenticate Docker to ACR
az acr login --name "${ACR%%.*}"

# Build from the oci/showme directory
docker build -t "${ACR}/showme:latest" oci/showme/

# Push to ACR
docker push "${ACR}/showme:latest"
```

After pushing, the Container App will pick up the new image on its next revision. Because `revision_mode` is `Single`, trigger a new revision by running `terraform apply` again or by updating the Container App directly:

```bash
az containerapp update \
  --name "<cluster_name>-showme" \
  --resource-group "<resource_group_name>" \
  --image "${ACR}/showme:latest"
```

### Building with ACR Tasks (no local Docker required)

```bash
ACR=$(terraform -chdir=.. output -raw acr_login_server)
ACR_NAME="${ACR%%.*}"

az acr build \
  --registry "$ACR_NAME" \
  --image showme:latest \
  oci/showme/
```

---

## Deploying

The `app_showme` module is invoked from the root `main.tf` and shares the resource group, VNet, and AKS subnet created by `sdx_edge_infra`. Run Terraform from the root of the repository:

```bash
terraform apply
```

After apply, retrieve the Container App domain:

```bash
terraform output aca_default_domain
```

### Verify the deployment

```bash
# From within the VNet or via the private endpoint
curl https://$(terraform output -raw aca_default_domain)/v1/me
```

If DNS is not yet resolving (private endpoint DNS propagates within ~10 minutes), test by resolving the IP directly:

```bash
nslookup $(terraform output -raw aca_default_domain)
```

---

## Module inputs

These variables are passed from the root module — they are not set directly.

| Name | Description |
|------|-------------|
| `cluster_name` | Name prefix for all resources in this module |
| `tags` | Tags applied to all resources |
| `vnet_name` | Pre-provisioned Landing Zone VNet name |
| `vnet_resource_group_name` | Resource group containing the Landing Zone VNet |
| `aca_subnet_cidr` | CIDR for the ACA infrastructure subnet — /27 minimum |
| `resource_group_id` | Shared resource group ID (from `sdx_edge_infra`) |
| `resource_group_name` | Shared resource group name (from `sdx_edge_infra`) |
| `resource_group_location` | Azure region (from `sdx_edge_infra`) |
| `aks_subnet_id` | AKS subnet ID — private endpoint is placed here |

## Module outputs

| Name | Description |
|------|-------------|
| `acr_login_server` | Container Registry hostname (`<name>.azurecr.io`) |
| `aca_default_domain` | Default domain of the Container App Environment |
