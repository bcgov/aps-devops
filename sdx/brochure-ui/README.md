# SDX Brochure

## AI Prompt

- Look for files in current directory only
- Starting code should be in `main.ts` TypeScript file
- Pages can be organized as separate pages in a pages folder
- Components common across pages can be created under a components folder
- Use the design components from https://www2.gov.bc.ca/gov/content/digital/design-system/components
- Use Deno runtime
- Use `jsr:@std/yaml` for YAML handling
- No environment variables
- Serve on port 8000
- Use latest tailwindcss
- Use latest React version

## Requirements

- Create a static website that is structured the same way as https://liityntakatalogi.suomi.fi/en_GB
- on the home page, can you find a nice background image that represents a secure data exchange
- Subsystems will come from https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog/subsystems
- Organizations come from https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog/organizations
- Instructions and Support can just be a link to https://developer.gov.bc.ca/docs/default/component/aps-infra-platform-docs/concepts/secure-data-exchange/
- Add a drill-down Organization detail page that mimics https://liityntakatalogi.suomi.fi/en_GB/organization/arek-oy
- Add a drill-down Subsystem detail page that mimics https://liityntakatalogi.suomi.fi/en_GB/dataset/prodpensionprovider
- Use Services from https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog/services to provide the details about what services are available by a subsystem
- For the API service operations, can you group them by the tags and put the tags in alphabetical order
- for the operations, make sure that the METHOD is spaced so that the path is aligned the same as other rows
- within the tag group of operations, sort the operations by path
- The service description can be markdown - can you add markdown support on the description
- add a "copy to clipboard" for the sdx identifier
- make the "copy to clipboard" a component and include it for the service sdx identifier as well
- can the copy button be made more sutle where there is no "copy" text and it's just the icon within any borders and next to the text
- add an "Activity" page and on it use the pql_service_code.json to render the metric as a time-series graph
- add a selectable "refresh interval" (Off, 10s, 30s)
- after the refresh it resets to off -fix it so that stays on the setting before page refreshes
- for the services detail on the subsystem, there is a `"specVersion": "asyncapi=3.1.0"` property that can have a value of "openapi=xxx" or "asyncapi=xxx". Use this information to show whether it is an OpenAPI or AsyncAPI spec (and what version). And then provide the operations in a way that makes sense in a subscriber/producer model
- Create a new Trust page that gets the data from a JWKS registry (https://sdx.gov.bc.ca/.well-known/jwks.json) and outputs nice information about each JWK record. If the record has an x5c then display each cert in the chain, showing key data and show its validity.
- update the org details page so that the "subsystem" card has an indication of whether it is a  
  "client only" vs has related services.

### Verification

- add to the activity log detail a "verification" - which will show various verification statuses (perhaps with a "security shield checkmark/cross")
  - put the display in its own component, and the logic in the lib folder
  - the verification will use the request/response header "X-Edge-Token" and "X-Entity-Sig"
  - "X-Entity-Sig" will use https://sdx.gov.bc.ca/keysets/sdx.org.min.citz/.well-known/jwks.json; the "sdx.org.min.citz" can be derived from the "X-Client-ID" in the case of it being in the request header, and service id if in response header. The Entity-Sig uses the signature of the X-Edge-Token JWT signature segment (3). Show an indication of result.
  - X-Edge-Token can be checked by looking in the token for the jwks_url and using that to validate the token using one of the public keys. Show an indication of result.
- for x-edge-token verification, use the "jwks_uri" instead. For the X-Entity-Sig, map the  
  `client:LAB.MIN.CITZ.SDG-FE` with the format `client:<env>.<memberclass>.<memberid>.<subsystem>`,  
  to `sdx.org.min.citz`, which is "sdx.org.<memberclass_lowercase>.<memberid_lowercase>"
- for X-Entity-Sig validation, check against each key in the jwks
- for the verification, check both request and response for X-Entity-Sig and X-Edge-Token and report  
  on them. Also if the jwk has the x5c, validate the certificate chain and report on "cert chain  
  pass"
- for each X-Entity-Sig verification, show the "O" of the leaf if there is a cert chain

## Running the Application

```sh
deno run --allow-net --allow-read --allow-env --allow-write main.ts
```

### Docker

Build the production image:

```sh
docker build -t sdx-brochure-ui .
```

Run it — `config.yaml` is intentionally not baked into the image (it's
environment-specific and gitignored), so mount one over `/app/config.yaml`
at run time:

```sh
docker run --rm -p 5500:5500 \
  -v "$(pwd)/config-dev.yaml:/app/config.yaml:ro" \
  sdx-brochure-ui
```

The app listens on port `5500` by default; override with `-e PORT=xxxx`
(and adjust `-p` to match).

## Deployment

```sh
helm upgrade --install sdx-brochure \
 --set fullnameOverride=sdx-brochure \
 -f chart.yaml -f .values-dev.yaml \
bcgov/generic-api
```

### Test

```sh
helm upgrade -n b8840c-test --install sdx-brochure \
 --set fullnameOverride=sdx-brochure \
 -f chart.yaml -f .values-test.yaml \
bcgov/generic-api
```

### Production

```sh
helm upgrade -n b8840c-prod --install sdx-brochure \
 --set fullnameOverride=sdx-brochure \
 -f chart.yaml -f .values-prod.yaml \
bcgov/generic-api
```

## Operational logs and APS-4791 validation

The catalogue's `/logs` page consumes the same-origin `/log-stream` endpoint.
The server fetches `LOG_STREAM_URL` and adds signature verification results to
Kafka SSE records before forwarding them. Browser clients do not need direct
access to the Kafka function. Configure OIDC and a session secret before using
logs: the proxy returns 503 when authentication is unconfigured and 401 when
there is no valid session. Upstream failures return a generic 502 response.
Operational responses must not be cached.

Sign-in currently establishes identity only. The proxy does not enforce Access
Manager roles, organization membership, or the selected catalogue environment.
`LOG_STREAM_URL` is one deployment-wide source. Do not treat the environment
picker as a log access filter. Production rollout needs an agreed audience and
an upstream source/access policy that matches it. Keep the Kafka function on a
private service network; it has no application authentication of its own.

Run focused regression tests from the repository root:

```sh
deno test sdx/brochure-ui/lib/log-stream_test.ts sdx/ape/functions/pubsub-kafka/history_test.ts
deno check sdx/ape/functions/pubsub-kafka/main.ts
```

Target-environment validation still required:

- Without a session, request `/log-stream` directly and confirm 401 and no events.
  With OIDC missing, confirm 503. Confirm valid and expired-session behavior.
- With an approved test identity, open `/logs`, send a synthetic test event to
  the configured topic, and confirm the record and verification results appear.
  Confirm waiting, pause/resume, clear, reconnect and upstream outage states.
- Confirm the source topic and environment match the approved audience; test a
  user outside that audience before allowing production operational data.
- Disconnect clients and check ephemeral Kafka consumer groups are removed.
- Confirm navigation/content and keyboard/screen-reader behavior with the owner.

### Release workflow requirements for APS-5011

The UI image is `ghcr.io/bcgov/aps-devops/sdx-ui`, built from
`sdx/brochure-ui`; the Kafka image/build context is defined in `.github/workflows/ape.yaml`
for `sdx/ape/functions/pubsub-kafka`. Publish component-specific release tags
and notes mapping each component to its source commit, immutable image digest,
configuration compatibility, validation evidence, and prior rollback digest.
Ensure the UI context includes `lib/log-stream.ts` and the Kafka context includes
`history.ts`. Rehearse both images and their mounted configuration in test
before production promotion. APS-4791 does not edit shared release workflows.
