# SDX Edge server

The SDX Edge chart deploys the following components:

- Kong Data Plane
- Fluentbit
- Prometheus
- Cert Renewal Job
- Cert Bootstrap Job

On Openshift environments, the Kong Data Plane is a passthrough from the Openshift HAProxy.

The inbound Proxy is an HTTP/2.0 listener that terminates with a certificate issued by an approved Certificate Authority.

## Deployment

> `TOKEN` is a one-time-use token for calling the CA to get a new certificate for mTLS and signing

```sh
export TOKEN="<TOKEN>"
export IP="<INTERNET_FACING_IP]"
export EDGE_ID="<EDGE NAME>"
export DOMAIN="${EDGE_ID}.servers.sdx"

helm upgrade --install ${EDGE_ID} \
  --set tls.client.bootstrap.token=${TOKEN} \
  --set tls.server.ip=${IP} \
  --set tls.client.cn=${DOMAIN} \
  --set route.host=${DOMAIN} \
  oci://ghcr.io/bcgov/aps-devops/sdx-edge:0.1.0
```

## Development

```sh
helm package sdx-edge
helm push sdx-edge-0.1.0.tgz oci://ghcr.io/bcgov/aps-devops
```
