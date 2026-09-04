# opal-server

## Installation

### Prerequisites

1. Install the `opal-server` secret

`ssh-keygen -t rsa -b 4096 -m pem`

In Vault, store:

- opal-master-token
- opal-encrypt-key
- opal-encrypt-crt

```sh
export MASTER_TOKEN="<CHANGEME>"
kubectl create secret --namespace b8840c-dev \
  --save-config --dry-run=client -o yaml \
  generic opal-server \
  --from-literal=OPAL_AUTH_MASTER_TOKEN=$MASTER_TOKEN \
  --from-file=OPAL_AUTH_PUBLIC_KEY=./id_rsa.pub \
  --from-file=OPAL_AUTH_PRIVATE_KEY=./id_rsa | kubectl apply -f -
```

### Install

```sh
helm upgrade --install opal \
  -f ./values.yaml \
   permitio/opal
```

### Getting a token for a data source

```sh
restish POST https://opal-api-gov-bc-ca.dev.api.gov.bc.ca/token \
 -H "Authorization: Bearer $MASTER_TOKEN" \
 'type: datasource, claims.client_id: share0'
```
