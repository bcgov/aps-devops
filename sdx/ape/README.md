# Policy and Event Management

Extending APS API Management solution to include a Policy Engine and Event Management.

## Installation

Steps for OPAL:

- deploy opal-server
- publish opal-api-gateway configuration
- deploy opal-client
- deploy opal-policies
- deploy opal-pip-catalog

Steps for Events:

- deploy pubsub-webhook
- deploy pubsub-kafka

## Usage

### Event Publish

Resources created:

- `GatewayService for sdx-events.api.gov.bc.ca`

> TODO: sdx-events by default is DENY
> TODO: upgrade jwt-keycloak (issuer, aud) - RS needs a token

> WF: `/sdx/0/<workflow_service_id>/forward/<system>`
> Create an endpoint that external shared services (like WF) can call to
> pass to the RS client, where it can get its own token
> WF Client - issue creds to get a client to call the RS
> WF gets a RS token, and then a RS token to get an Amina token

```json
{
  "pattern": "events-publisher.r1",
  "parameters": {
    "service_id": "LAB.USR.ACOPE.HELLO-WORLD-APPLICATION.v0"
  }
}
```

### Event Webhook

Resources created:

- `Webhook`

```json
{
  "pattern": "events-webhook.r1",
  "parameters": {
    "conn_id": "42",
    "client_id": "LAB.MIN.CITZ.SDG-FE",
    "service_id": "LAB.USR.ACOPE.HELLO-WORLD-APPLICATION.v0",
    "webhook_url": "https://bright-island-08.webhook.cool"
  }
}
```

### OPAL Policy

Resources created:

- `RegoPolicy`

> TODO: For "playground" have sample data for inputs

```json
{
  "pattern": "opal-policy.r1",
  "parameters": {
    "subsystem_id": "LAB.USR.ACOPE.APS-KAFKA",
    "name": "authz",
    "policy": "package LAB_USR_ACOPE_APS_KAFKA.authz\n\nimport rego.v1\n\n# Default deny everything\ndefault allow := false\n\n# Allow GET requests\nallow if {\n    input.method == \"GET\"\n}"
  }
}
```

### OPAL Data Source

Resources created:

- `PolicyDataSource`

> TODO: Create a gateway route for the PDPs to access (subsystem edge server)
> TODO: Use "internal" url
> TODO: Update PolicyDataSource to use the internal url
> TODO: Deploy opal-client to edge-server optionally (and cleanup bootstrap)

```json
{
  "pattern": "opal-data-source.r1",
  "parameters": {
    "subsystem_id": "LAB.USR.ACOPE.APS-KAFKA",
    "name": "user-gateways",
    "upstream_url": "https://httpbun.com/any"
  }
}
```
