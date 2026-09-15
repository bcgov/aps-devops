# opal-pip-catalog

## AI Prompt

- Look for files in current directory only
- All code in single `main.ts` TypeScript file
- Use Deno runtime
- Use SQLite database (`https://deno.land/x/sqlite`)
- Use `jsr:@std/yaml` for YAML handling
- Create database if it doesn't exist
- No environment variables
- Serve on port 8000
- Database location: `./data/sqlite.db`
- Build REST API endpoints with database interactions

## Requirements

- want an endpoint that returns a static list of entries
- the entries can be empty by default

## Running the API

```sh
deno run --allow-net --allow-read --allow-write --allow-env main.ts
```

```sh
restish PUT http://localhost:8000/entries \
  'name: abc, dst_path: /abc, topics[]: tenant_data, url: "https://httpbun.com"'
```

## Deployment

```sh
helm upgrade --install opal-pip-catalog \
 --set fullnameOverride=opal-pip-catalog \
 -f chart.yaml \
 --set-file "config[0].contents=main.ts" \
bcgov/generic-api
```

### Test a PIP

#### Register a PIP

```sh
restish PUT https://opal-pip-catalog-api-gov-bc-ca.dev.api.gov.bc.ca/entries \
  url: https://httpbun.com, \
  "topics: tenant_data", \
  dst_path: "/abc"
```

#### Troubleshoot

```sh
-- get all entries
restish GET https://opal-pip-catalog-api-gov-bc-ca.dev.api.gov.bc.ca/entries

-- get entry
restish GET https://opal-pip-catalog-api-gov-bc-ca.dev.api.gov.bc.ca/entries/1

-- add policy
restish PUT https://opal-pip-catalog-api-gov-bc-ca.dev.api.gov.bc.ca/entries \
  'name: abc, dst_path: /abc, topics[]: tenant_data, url: "https://httpbun.com"'

-- change notification

-- get a token
restish POST https://opal-api-gov-bc-ca.dev.api.gov.bc.ca/token \
 -H "Authorization: Bearer $MASTER_TOKEN" \
 'type: datasource, email: "aidan.cope@gov.bc.ca"'

restish POST https://opal-api-gov-bc-ca.dev.api.gov.bc.ca/data/config \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  'reason: just because, entries[]: {url: "https://httpbun.com/any", topics[]: tenant_data, dst_path: /abc}'

restish GET https://opal-client-api-gov-bc-ca.dev.api.gov.bc.ca/v1/data/abc/headers

```
