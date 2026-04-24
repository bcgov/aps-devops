resource "azurerm_cdn_frontdoor_profile" "main" {
  name                = "${var.cluster_name}-afd"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Premium_AzureFrontDoor"
  tags                = var.tags
}

# WAF policy temporarily commented out to diagnose NotStarted deployment blockage.
# Suspected cause: DRS 2.1 uses anomaly scoring — "Block" at the rule-set level
# may be invalid for anomaly-scoring mode and silently stall the profile deployment.
# Re-enable once origin-group reaches Succeeded without WAF.
#
# resource "azurerm_cdn_frontdoor_firewall_policy" "main" {
#   name                = replace("${var.cluster_name}waf", "-", "")
#   resource_group_name = azurerm_resource_group.main.name
#   sku_name            = azurerm_cdn_frontdoor_profile.main.sku_name
#   enabled             = true
#   mode                = "Prevention"
#
#   managed_rule {
#     type    = "Microsoft_DefaultRuleSet"
#     version = "2.1"
#     action  = "Block"
#   }
#
#   managed_rule {
#     type    = "Microsoft_BotManagerRuleSet"
#     version = "1.1"
#     action  = "Block"
#   }
# }

resource "azurerm_cdn_frontdoor_endpoint" "main" {
  name                     = "${var.cluster_name}-ep"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
  tags                     = var.tags
}

# Kong origin group/origin/route temporarily commented out while diagnosing
# AFD NotStarted issue. Re-enable once /hello route confirms AFD deploys correctly.
#
# resource "azurerm_cdn_frontdoor_origin_group" "kong" { ... }
# resource "azurerm_cdn_frontdoor_origin" "kong" { ... }
# resource "azurerm_cdn_frontdoor_route" "kong" { ... }

# Temporarily removed to diagnose NotStarted deployment blockage.
# Re-add once endpoint and origin-group reach Succeeded status.
# resource "azurerm_cdn_frontdoor_security_policy" "main" {
#   name                     = "${var.cluster_name}-sec"
#   cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
#
#   security_policies {
#     firewall {
#       cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.main.id
#
#       association {
#         domain {
#           cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.main.id
#         }
#         patterns_to_match = ["/*"]
#       }
#     }
#   }
# }
