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

## Deployment

> `TOKEN` is a one-time-use token for calling the CA to get a new client certificate for mTLS and signing

```sh
helm upgrade --install puppykitten \
  --set-file tls.ca=sdx_ca.crt \
  --set-file tls.server.crt=ministryofpuppiesandkittens_xyz.crt \
  --set-file tls.server.key=ministryofpuppiesandkittens.key \
  --set tls.client.bootstrap.token=$TOKEN \
sdx-edge
```
