# Gateway configuration

### API gateway for OPAL services

There are four services that have been introduced to support a policy engine.

New APS Gateway in DEV `gw-16a07` (on Gold cluster)

- DNS `opal.api.gov.bc.ca` -> http://opal-server:7002
- DNS `opal-pip-catalog.api.gov.bc.ca` -> http://opal-pip-catalog
- DNS `opal-policies.api.gov.bc.ca` -> http://opal-policies
- `opal-client.api.gov.bc.ca` -> http://opal-client

Gateway configuration at: `gw-config.yaml`

- https://opal-api-gov-bc-ca.dev.api.gov.bc.ca/
- https://opal-pip-catalog-api-gov-bc-ca.dev.api.gov.bc.ca/entries
- https://opal-policies-api-gov-bc-ca.dev.api.gov.bc.ca/tuples
- https://opal-client-api-gov-bc-ca.dev.api.gov.bc.ca/
