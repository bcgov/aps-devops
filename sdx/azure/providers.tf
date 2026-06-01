terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.69"
    }
    azapi = {
      source  = "azure/azapi"
      version = "~> 2.9"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
  }
}

provider "azapi" {}

provider "azurerm" {
  features {}
}

# With Entra ID auth + local accounts disabled, kube_config no longer carries a
# client cert/key — it's token-based. Authenticate via kubelogin, which exchanges
# the caller's Entra ID identity (mode set by var.kubelogin_login_mode) for an AKS
# API-server token.
# "6dae42f8-4368-4678-94ff-3960e28e3630" is the well-known AKS AAD server app ID
# (constant across Azure public cloud).
locals {
  kubelogin_exec_args = [
    "get-token",
    "--login", var.kubelogin_login_mode,
    "--server-id", "6dae42f8-4368-4678-94ff-3960e28e3630",
  ]
}

provider "kubernetes" {
  host                   = module.sdx_edge_infra.kube_config.host
  cluster_ca_certificate = base64decode(module.sdx_edge_infra.kube_config.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "kubelogin"
    args        = local.kubelogin_exec_args
  }
}

provider "helm" {
  kubernetes {
    host                   = module.sdx_edge_infra.kube_config.host
    cluster_ca_certificate = base64decode(module.sdx_edge_infra.kube_config.cluster_ca_certificate)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "kubelogin"
      args        = local.kubelogin_exec_args
    }
  }
}
