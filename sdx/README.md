# SDX Edge Server

A Kubernetes deployment for running SDX (Secure Data Exchange) Edge Servers as hybrid Kong Gateway data planes with enhanced security and trust capabilities.

## Components

### Helm Chart (`chart/sdx-edge`)

**Chart Version:** 0.3.0
**App Version:** 3.9.1

Deploys a Kong Gateway data plane node configured for secure data exchange operations. The chart includes:

- Kong Gateway deployment with custom plugins
- mTLS-based cluster communication with control plane
- Fluent Bit for log forwarding
- Prometheus metrics collection
- Network policies for OpenShift/Kubernetes
- Horizontal Pod Autoscaling support

#### Key Features

- **Hybrid deployment mode**: Data plane node that syncs configuration from a control plane
- **Mutual TLS**: PKI-based authentication for cluster and client connections
- **Custom authentication**: JWT Keycloak, OIDC, and mTLS-ACL plugins
- **Trust framework**: Digital signature verification, timestamp validation, and trust registry integration
- **High availability**: Configurable replicas with HPA support

#### Installation

> `TOKEN` is a one-time-use token for calling the CA to get a new certificate for mTLS and signing

````sh
export TOKEN="<TOKEN>"
export IP="<INTERNET_FACING_IP]"
export EDGE_ID="<EDGE NAME>"
export DOMAIN="${EDGE_ID}.servers.sdx"

# bootsrap and kong
helm upgrade --install ${EDGE_ID} \
  --set bootstrap.tls.token=${TOKEN} \
  --set bootstrap.tls.ip=${IP} \
  --set bootstrap.tls.cn=${DOMAIN} \
  oci://ghcr.io/bcgov/aps-devops/sdx-edge:0.1.0

# Optional OPAL client

```sh
  --set opal.client.enabled=true \
  --set opal.client.token=${OPAL_TOKEN} \
````

#### Development

```sh
helm package sdx-edge
helm push sdx-edge-0.2.0.tgz oci://ghcr.io/bcgov/aps-devops
```

#### Configuration

The following table lists the configurable parameters in `values.yaml`:

| Parameter                   | Description                                                    | Default                                                                 |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `name`                      | Release name identifier                                        | `example`                                                               |
| `image.tag`                 | Container image tag                                            | `3.9-37f68b55`                                                          |
| `hpa.minReplicas`           | Minimum number of pod replicas                                 | `1`                                                                     |
| `hpa.maxReplicas`           | Maximum number of pod replicas                                 | `1`                                                                     |
| `route.host`                | Edge server hostname for external routing                      | `example.servers.sdx`                                                   |
| `sdx_control_url`           | Control plane URL for hybrid deployment (format: `host:port`)  | `gwcluster-api-gov-bc-ca-lab.dev.api.gov.bc.ca:443`                     |
| `client_ca_url`             | Certificate authority endpoint for client certificate issuance | `https://ca-1d4461-prod.apps.silver.devops.gov.bc.ca`                   |
| `sdx_aggregator_url`        | SDX aggregator service endpoint                                | `gwaggregator-api-gov-bc-ca-lab.dev.api.gov.bc.ca`                      |
| `mtls_required`             | Enable/disable mutual TLS requirement                          | `true`                                                                  |
| `https_proxy`               | HTTP proxy URL for restricted network environments             | `""` (empty, disabled)                                                  |
| `bootstrap.tls.token`       | Bootstrap token for initial certificate request                | `""` (must be provided)                                                 |
| `tls.client.cn`             | Common Name for client certificate                             | `example.com`                                                           |
| `tls.server.ip`             | IP address to add as SAN to edge server certificate            | `""` (optional)                                                         |
| `tls.public_ca`             | PEM-encoded public CA certificates for trust chain             | (includes Sectigo, USERTrust, SDX, APS, Amazon, Let's Encrypt root CAs) |
| `nginx_conf`                | Custom nginx configuration snippet                             | Session storage and secret configuration                                |
| `shared.rbac`               | Enable RBAC resources                                          | `true`                                                                  |
| `shared.ca_secret`          | Create CA secret resource                                      | `true`                                                                  |
| `shared.fluentbit.enabled`  | Enable Fluent Bit sidecar for log forwarding                   | `true`                                                                  |
| `shared.prometheus.enabled` | Enable Prometheus metrics collection                           | `true`                                                                  |
| `aws.enabled`               | Enable AWS integration                                         | `false`                                                                 |
| `aws.region`                | AWS region for services                                        | `us-west-2`                                                             |
| `aws.access_key_id`         | AWS access key ID for authentication                           | `""` (empty)                                                            |
| `aws.secret_access_key`     | AWS secret access key for authentication                       | `""` (empty)                                                            |
| `prom_remote_write.url`     | Prometheus `remote_write` endpoint (Gold). Empty = disabled.   | `""` (disabled)                                                         |
| `prom_remote_write.external_labels` | Extra labels added to every series before remote_write | `{ datacenter: edge }`                                                  |
| `prom_remote_write.queue_config`    | Prometheus `remote_write` queue tuning                 | `{ max_samples_per_send: 1000, capacity: 10000, max_shards: 30 }`       |

**Required Values:**

The following values must be set during installation:

- `bootstrap.tls.token` - Required for certificate bootstrapping
- `route.host` - Required for proper external routing

**Example Override:**

```yaml
# custom-values.yaml
route:
  host: my-edge.servers.sdx

sdx_control_url: my-control-plane.example.com:443

tls:
  client:
    bootstrap:
      token: "my-bootstrap-token-here"
    cn: "my-edge-server.example.com"
  server:
    ip: "192.168.1.100"

hpa:
  minReplicas: 2
  maxReplicas: 10
```

### Container Image (`image/Dockerfile`)

**Base Image:** Kong Gateway 3.9.1

Custom Kong Gateway image with extended plugin suite for secure data exchange. Configured as a data plane node with:

#### Included Plugins

**Custom BCGov Plugins:**

- Authentication: `jwt-keycloak`, `oidc`, `oidc-consumer`, `mtls-auth`, `mtls-acl`
- Trust Framework: `trust-jwks`, `trust-ledger`, `trust-registry`, `trust-sign`, `trust-timestamp`, `trust-verify-digest`, `trust-verify-signature`
- Token Management: `dpop`, `token-exchange`, `openid-authzen`
- Security: `response-signer`, `gwa-ip-anonymity`
- Utilities: `bcgov-gwa-endpoint`, `kong-spec-expose`, `kong-upstream-jwt`

**Performance Optimizations:**

- 2 worker processes
- 100k max connections per worker
- 200k file descriptor limit
- Optimized buffer sizes for large payloads
- Custom plugin priorities for proper execution order

#### Build

```bash
cd image
docker build -t sdx-edge:3.9.1 .
```

## Architecture

```
┌─────────────────┐
│  SDX Control    │
│  Plane          │
└────────┬────────┘
         │ mTLS
         │ (port 443)
         │
┌────────▼────────┐
│  SDX Edge       │
│  (Data Plane)   │
│                 │
│  - Kong Gateway │
│  - FluentBit    │
│  - Prometheus   │
└────────┬────────┘
         │
    ┌────▼─────┬──────────┐
    │          │          │
  Client    Client    Client
  (mTLS)    (mTLS)   (mTLS)
```

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- Valid TLS certificates for cluster and client authentication
- Access to SDX control plane
- Certificate authority endpoint for client certificate issuance

## Security Considerations

- All connections require mutual TLS authentication
- Client certificates verified against configured CA
- Cluster communication secured via PKI
- Proxy SSL verification enabled for upstream services
- HTTP proxy support for restricted network environments

## Monitoring

- Prometheus metrics exposed on `/metrics` endpoint, forwarded to central Prometheus instance via `remote_write` protocol.
- Fluent Bit forwards logs to configured aggregator
- Status endpoint available on port 8100 for health checks

### Shipping metrics to a central Prometheus

When `prom_remote_write.url` is set, the in-cluster `sdx-prometheus-server`
StatefulSet ships every series it scrapes (Kong on 8100, fluentbit on 2021)
to the configured remote endpoint via the Prometheus `remote_write` protocol.

- Authentication: mTLS, reusing the same edge client certificate (`{release}-client` secret) and `sdx-public-ca` CA that fluentbit uses to ship logs to the SDX log aggregator.
- Identifying labels: Kong metrics include `dataplane` (from the edge pod label `data_plane`). Keys in `prom_remote_write.external_labels` (default `datacenter=edge`) are added to every series on remote_write.
- Default queue tuning is suitable for a single low/medium-traffic edge; tune `prom_remote_write.queue_config` for busier edges. See [Prometheus remote_write tuning](https://prometheus.io/docs/practices/remote_write/).

Note: only the helm release that owns `shared.prometheus.enabled=true` in a
namespace (e.g. `share0` in `b8840c-dev`) needs this flag — releases that
re-use the shared Prometheus inherit it automatically.

Example:

```sh
helm upgrade --install share0 \
  --set prom_remote_write.url=https://gw-metrics-aggregator-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1/write \
  oci://ghcr.io/bcgov/aps-devops/sdx-edge:0.3.0
```

## License

Apache 2.0
