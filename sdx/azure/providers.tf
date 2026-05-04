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

provider "kubernetes" {
  host                   = module.sdx_edge_infra.kube_config.host
  client_certificate     = base64decode(module.sdx_edge_infra.kube_config.client_certificate)
  client_key             = base64decode(module.sdx_edge_infra.kube_config.client_key)
  cluster_ca_certificate = base64decode(module.sdx_edge_infra.kube_config.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = module.sdx_edge_infra.kube_config.host
    client_certificate     = base64decode(module.sdx_edge_infra.kube_config.client_certificate)
    client_key             = base64decode(module.sdx_edge_infra.kube_config.client_key)
    cluster_ca_certificate = base64decode(module.sdx_edge_infra.kube_config.cluster_ca_certificate)
  }
}
