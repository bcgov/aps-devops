# SDX Security Edge

The SDX Security Edge chart deploys the following components:

- Kong Data Plane
- Fluentbit
- Prometheus
- Cert Renewal Job

On Openshift environments, the Kong Data Plane is a passthrough from the Openshift HAProxy.

The inbound Proxy is an HTTP/2.0 listener that terminates with an OV or EV certificate issued by a public CA.

The outbound Proxy has optional setup of mTLS (Peer-to-Peer) or to an Upstream service.

A Client Authentication and Signing certificate is issued and used for connecting to the SDX Operator and for signing messages.

## Development

```
helm package sdx-edge
helm push sdx-edge-0.1.0.tgz oci://ghcr.io/bcgov/aps-devops
```

## Deployment

> `TOKEN` is a one-time-use token for calling the CA to get a new client certificate for mTLS and signing

In your working directory, create the following structure:

- `tls.crt` : TLS certificate from a public CA
- `tls.key` : TLS certificate key from a public CA

```sh
export DOMAIN="sdx.gov.bc.ca"
export EDGE_ID="sdxgov"

helm upgrade --install ${EDGE_ID} \
  --set-file tls.ca=sdx_ca.crt \
  --set-file tls.server.crt=tls.crt \
  --set-file tls.server.key=tls.key \
  --set tls.client.bootstrap.token=$TOKEN \
  --set tls.client.cn=${EDGE_ID}.edge.sdx \
  --set route.host=${DOMAIN} \
oci://ghcr.io/bcgov/aps-devops/sdx-edge:0.1.0
```
