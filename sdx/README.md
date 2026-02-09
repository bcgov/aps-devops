# SDX Edge Server

A Kubernetes deployment for running SDX (Secure Data Exchange) Edge Servers as hybrid Kong Gateway data planes with enhanced security and trust capabilities.

## Components

### Helm Chart (`chart/sdx-edge`)

**Chart Version:** 0.1.0
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

```bash
helm install <release-name> ./chart/sdx-edge \
  --set route.host=<your-edge-host> \
  --set sdx_control_url=<control-plane-url> \
  --set tls.client.bootstrap.token=<bootstrap-token> \
  --set tls.client.cn=<client-cn>
```

#### Configuration

The following table lists the configurable parameters in `values.yaml`:

| Parameter                    | Description                                                    | Default                                                                 |
| ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `name`                       | Release name identifier                                        | `example`                                                               |
| `image.tag`                  | Container image tag                                            | `3.9-37f68b55`                                                          |
| `hpa.minReplicas`            | Minimum number of pod replicas                                 | `1`                                                                     |
| `hpa.maxReplicas`            | Maximum number of pod replicas                                 | `1`                                                                     |
| `route.host`                 | Edge server hostname for external routing                      | `example.servers.sdx`                                                   |
| `sdx_control_url`            | Control plane URL for hybrid deployment (format: `host:port`)  | `gwcluster-api-gov-bc-ca-lab.dev.api.gov.bc.ca:443`                     |
| `client_ca_url`              | Certificate authority endpoint for client certificate issuance | `https://ca-1d4461-prod.apps.silver.devops.gov.bc.ca`                   |
| `sdx_aggregator_url`         | SDX aggregator service endpoint                                | `gwaggregator-api-gov-bc-ca-lab.dev.api.gov.bc.ca`                      |
| `mtls_required`              | Enable/disable mutual TLS requirement                          | `true`                                                                  |
| `https_proxy`                | HTTP proxy URL for restricted network environments             | `""` (empty, disabled)                                                  |
| `tls.client.bootstrap.token` | Bootstrap token for initial certificate request                | `""` (must be provided)                                                 |
| `tls.client.cn`              | Common Name for client certificate                             | `example.com`                                                           |
| `tls.server.ip`              | IP address to add as SAN to edge server certificate            | `""` (optional)                                                         |
| `tls.public_ca`              | PEM-encoded public CA certificates for trust chain             | (includes Sectigo, USERTrust, SDX, APS, Amazon, Let's Encrypt root CAs) |
| `nginx_conf`                 | Custom nginx configuration snippet                             | Session storage and secret configuration                                |
| `shared.rbac`                | Enable RBAC resources                                          | `true`                                                                  |
| `shared.ca_secret`           | Create CA secret resource                                      | `true`                                                                  |
| `shared.fluentbit.enabled`   | Enable Fluent Bit sidecar for log forwarding                   | `true`                                                                  |
| `shared.prometheus.enabled`  | Enable Prometheus metrics collection                           | `true`                                                                  |
| `aws.enabled`                | Enable AWS integration                                         | `false`                                                                 |
| `aws.region`                 | AWS region for services                                        | `us-west-2`                                                             |
| `aws.access_key_id`          | AWS access key ID for authentication                           | `""` (empty)                                                            |
| `aws.secret_access_key`      | AWS secret access key for authentication                       | `""` (empty)                                                            |

**Required Values:**

The following values must be set during installation:

- `tls.client.bootstrap.token` - Required for certificate bootstrapping
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

- Prometheus metrics exposed on `/metrics` endpoint
- Fluent Bit forwards logs to configured aggregator
- Status endpoint available on port 8100 for health checks

## License

Apache 2.0
