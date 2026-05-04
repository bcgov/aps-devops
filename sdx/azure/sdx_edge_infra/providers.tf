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
  }
}

provider "azurerm" {
  features {}
}
