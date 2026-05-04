# Azure Terraform — SDX Edge

Provisions all Azure resources required to expose the SDX Edge service on the
internet via Application Gateway and AKS, then deploys the sdx-edge Helm chart.

## Prerequisites

- Azure CLI authenticated: `az login`
- Subscription set: `az account set --subscription <id>`
- Terraform >= 1.5

## Quick Start

```sh
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — at minimum set sdx_bootstrap_token and edge_id

terraform init
terraform plan
terraform apply
```

## What Gets Created

| Resource                  | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| Resource Group            | Container for all resources                                        |
| Virtual Network + Subnets | Isolated network; dedicated subnets for AKS and App Gateway        |
| Static Public IP (App GW) | App Gateway frontend; not in the mTLS data path                    |
| Static Public IP (Kong LB)| Internet-facing IP for mTLS; embedded as SAN in the edge TLS cert  |
| NSG (AKS subnet)          | Allows inbound 80/443 from Internet and Azure LB health probes     |
| Application Gateway v2    | HTTP entry point; managed at runtime by AGIC (not used for mTLS)   |
| AKS Cluster               | Kubernetes cluster with AGIC add-on enabled                        |
| Role Assignments          | AGIC Contributor on App GW; AKS Network Contributor on RG          |
| Helm Release — sdx-edge   | Kong Gateway data plane wired to the SDX control plane via mTLS    |
| LoadBalancer Service      | L4 TCP passthrough → Kong:8443; preserves full mTLS handshake      |

## DNS

After `terraform apply`, point a CNAME for `<edge_id>.servers.sdx` at the
`kong_lb_fqdn` output (e.g. `my-edge.canadacentral.cloudapp.azure.com`).

## mTLS

mTLS traffic flows through the Azure L4 Load Balancer directly to Kong on port
8443 — no TLS termination at the gateway. The Application Gateway remains
provisioned for the AGIC add-on but is not in the mTLS data path.
