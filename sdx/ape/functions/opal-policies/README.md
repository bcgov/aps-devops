# pip-policies

## AI Prompt

- Look for files in current directory only
- All code in single `main.ts` TypeScript file
- Use Deno runtime
- Use `jsr:@std/yaml` for YAML handling
- No environment variables unless explicitely mentioned in requirements
- Listen for SIGTERM and call deno exit
- Serve on port 8000

Database specs:

- Use SQLite database (`https://deno.land/x/sqlite`)
- Create database if it doesn't exist
- No environment variables for sqlite
- Database location: `./data/sqlite.db`

## Requirements

- want an endpoint that performs CRUD for Policies
- also support a PUT for "upsert" where it is transactionally safe
- Policy will have: { package: string, policy: string }
- "package" is a unique key

- also want a `/bundle.tar.gz` that is an OPAL Bundle using all the "resources" where the resources are rego policies in the format:

```json
{
  "package_name_1": "policy_1",
  "package_name_2": "policy_2"
}
```

- include an ETag for the `bundle.tar.gz`
- when there is an update to the policies, call the opal webhook

## Running the API

```sh
deno run --no-prompt --allow-net --allow-read --allow-write --allow-env=OPAL_WEBHOOK_URL main.ts
```

```sh
restish PUT http://localhost:8000/policies/lab_min_citz_sys0 \
  package: lab_min_citz_sys0, policy: @../../policies/simple-get-only.rego

restish GET http://localhost:8000/bundle.tar.gz
```

## Prerequisites

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
  generic opal-policies-client-token \
  --from-literal=token=$CLIENT_TOKEN | kubectl apply -f -
```

## Deployment

```sh
helm upgrade --install opal-policies \
 --set fullnameOverride=opal-policies \
 -f chart.yaml \
 --set-file "config[0].contents=main.ts" \
bcgov/generic-api
```

### Test a policy

#### Deploy policy

```sh
restish PUT https://opal-policies-api-gov-bc-ca.dev.api.gov.bc.ca/policies/lab_min_citz_sys0.authz \
  package: lab_min_citz_sys0.authz, policy: @../../policies/simple-get-only.rego
```

#### Validate policy

```sh
restish POST https://opal-client-api-gov-bc-ca.dev.api.gov.bc.ca/v1/data/lab_min_citz_sys0/authz/allow \
  'input: {method: GET }'
```

#### Troubleshoot

```sh
-- get all the policies
restish GET https://opal-policies-api-gov-bc-ca.dev.api.gov.bc.ca/policies

-- get bundle
restish GET https://opal-policies-api-gov-bc-ca.dev.api.gov.bc.ca/bundle.tar.gz

```
