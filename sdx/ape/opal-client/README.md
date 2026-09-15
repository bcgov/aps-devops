# opal-server

## Installation

### Prerequisites

1. Install the `opal-client` secret

```sh
restish POST https://opal-api-gov-bc-ca.dev.api.gov.bc.ca/token \
 -H "Authorization: Bearer $MASTER_TOKEN" \
 type: client
```

```sh
export CLIENT_TOKEN="<FROM_ABOVE>"
kubectl create secret --namespace b8840c-dev \
  --save-config --dry-run=client -o yaml \
  generic opal-client \
  --from-literal=OPAL_CLIENT_TOKEN=$CLIENT_TOKEN | kubectl apply -f -
```

### Install

```sh
helm upgrade --install opal-test \
  -f ./values.yaml \
   permitio/opal
```
