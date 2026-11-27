# SDX Brochure

## AI Prompt

- Look for files in current directory only
- Starting code should be in `main.ts` TypeScript file
- Pages can be organized as separate pages in a pages folder
- Components common across pages can be created under a components folder
- Use the design components from https://www2.gov.bc.ca/gov/content/digital/design-system/components
- Use Deno runtime
- Use `jsr:@std/yaml` for YAML handling
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

### Iteration - design system review

Get a deep understanding of the UX design system at https://github.com/bcgov/design-system and at https://www2.gov.bc.ca/gov/content/digital/design-system/components and refactor the components and pages so that they conform to all the standards described in the design system.

It does not look like the design system was reviewed, for example the header is supposed to be background white (https://www2.gov.bc.ca/gov/content/digital/design-system/components/header)... do a better review

Use the following as sources:

- https://github.com/bcgov/design-system for ensuring the requirements for each component are satisfied
- Use the components and storybook described here https://designsystem.gov.bc.ca/react-components/?path=/docs/introduction--docs
- any component that is not in the design system, create as a custom component under "components/custom"
- for components that are in the design system, refactor to use it
- also make sure all the "accessibility" requirements are satisfied for each component

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

Build the client bundle first (only needed after changing anything under
`client/`, or once before the first run) — this is what mounts the real
`@bcgov/design-system-react-components` Header/Footer/Subheader in the
browser; see `client/entry.tsx`:

```sh
deno task build:client
```

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

The Common SSO connection request entry point is controlled in `config.yaml`:

```yaml
connections:
  r1RequestUrl: "https://sso-requests.example.gov.bc.ca/"
```

Direct R0 requests remain available through the SDX API for tools such as Restish;
they are not exposed in this UI.

## Catalogue refresh

The brochure UI reads organization, subsystem, and service lists from the
Portal HTTP API. With both refresh options disabled, it fetches these lists
on request.

### Environment variables

| Variable | Value |
| --- | --- |
| `SDX_CATALOG_REFRESH_PERIOD_SECONDS` | Whole seconds between background API refreshes. Unset or `0` disables polling. A positive value enables an initial refresh at startup and periodic refreshes after that. |
| `SDX_CATALOG_LISTENER_ENABLED` | Set to `true` to listen for changes on a writable Portal PostgreSQL primary. Unset or any other value leaves it off. |
| `SDX_CATALOG_DATABASE_URL` | PostgreSQL URL for the Portal database that owns the catalogue tables. Required only when the listener is enabled. Supply it from a Kubernetes Secret or equivalent secret store. |
| `SDX_API_BASE` | Catalogue HTTP API for the same Portal environment. All cache refreshes read from this API. |

Each UI pod refreshes independently. During a periodic refresh it can serve
the previous successful value for a list. If that refresh fails, it keeps
that value and retries on the next tick. The OpenAPI detail endpoints and the
Scopes page keep their request-time reads.

### Standby and promotion

On a Patroni standby, leave the listener off and set a refresh period, for
example `30` seconds. Point `SDX_API_BASE` at the Portal API for that site.
New data becomes visible after PostgreSQL replays the change and the next
successful API refresh completes.

After promotion, check that the database is writable (`SELECT
pg_is_in_recovery();` returns `false`). Update the brochure deployment with
the database URL for the promoted primary and set
`SDX_CATALOG_LISTENER_ENABLED=true`. You can keep polling as a fallback,
increase its interval, or set it to `0` for listener-only mode. Changes to
these environment variables take effect on pod restart.

### PostgreSQL listener

A committed Portal change invalidates the lists in every listening pod. The
next request reloads the lists it needs. In listener-only mode, cached lists
also expire after 60 seconds. While the PostgreSQL connection is down, the UI
keeps polling if a period is configured and otherwise uses request-time
reads. The listener retries after five seconds and invalidates the cache
again when it subscribes.

The co-located Portal database and brochure UI connect without TLS. Use the
internal Portal database service hostname, port, database name, and dedicated
listener credentials for the target environment.

```text
postgresql://sdx_brochure_listener:<url-encoded-password>@<portal-postgres-host>:5432/keystonejs?sslmode=disable
```

If another deployment uses TLS, set `sslmode=verify-full` and use the hostname
on the server certificate. For a private CA, mount its PEM in the UI pod and
add `&sslrootcert=/path/to/portal-ca.pem` to the URL.

Permit the UI pods to reach the database through the relevant network policy
and PostgreSQL client authentication rules. Use a direct connection or a
session-mode pool. Each UI pod holds one session for `LISTEN`.

### Listener role

Run as a PostgreSQL administrator. Replace `keystonejs` if the database name
differs. In `psql`, use `\password` to set the password interactively and store
it in the Secret that supplies the connection URL.

```sql
CREATE ROLE sdx_brochure_listener LOGIN;
GRANT CONNECT ON DATABASE keystonejs TO sdx_brochure_listener;
\password sdx_brochure_listener
```

The listener needs `CONNECT` and no table grants, schema grants, trigger
privileges, or membership in the Portal application role. Check any effective
privileges the login inherits from `PUBLIC` in your database. PostgreSQL
notifications are visible to sessions connected to that database, so this
channel carries an empty payload.

### Portal database triggers

Install the triggers using the Portal schema migration or database owner role.
Confirm the schema and physical table names first. The example uses Keystone's
quoted list names in `public`.

```sql
CREATE FUNCTION public.notify_sdx_catalogue_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_catalog.pg_notify('sdx_catalogue_changed', '');
  RETURN NULL;
END;
$$;

CREATE TRIGGER sdx_catalogue_organization_changed
AFTER INSERT OR UPDATE OR DELETE ON public."Organization"
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_sdx_catalogue_changed();

CREATE TRIGGER sdx_catalogue_subsystem_changed
AFTER INSERT OR UPDATE OR DELETE ON public."Subsystem"
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_sdx_catalogue_changed();

CREATE TRIGGER sdx_catalogue_spec_changed
AFTER INSERT OR UPDATE OR DELETE ON public."OpenAPISpec"
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_sdx_catalogue_changed();
```

After enabling the listener in test, warm a catalogue page on both replicas.
Publish or update a test record through Portal and check that the next read
after notification shows the update on each replica. Disable the flag to
return to request-time reads. To remove the migration, drop the three triggers
before dropping the function.

See the [PostgreSQL LISTEN documentation](https://www.postgresql.org/docs/current/sql-listen.html)
and [node-postgres TLS options](https://node-postgres.com/features/ssl).

## Deployment

```sh
helm upgrade --install sdx-brochure \
 --set fullnameOverride=sdx-brochure \
 -f chart.yaml -f .values-dev.yaml \
bcgov/generic-api
```

The ISA traffic chart needs a metrics source with at least 30 days of history.
`ISA_PROMETHEUS_URL` points it at Thanos Query in the Helm deployment, while
`PROMETHEUS_URL` serves the live Metrics page. Existing deployments that point
`PROMETHEUS_URL` at the in-cluster `thanos-prom-prometheus-server` service
automatically use the sibling `thanos-query:9090` service for ISA traffic.

### Test

```sh
helm upgrade -n b8840c-test --install sdx-brochure \
 --set fullnameOverride=sdx-brochure \
 -f chart.yaml -f .values-test.yaml -f values-test.yaml \
bcgov/generic-api
```

### Production

```sh
helm upgrade -n b8840c-prod --install sdx-brochure \
 --set fullnameOverride=sdx-brochure \
 -f chart.yaml -f .values-prod.yaml \
bcgov/generic-api
```

Organization signing setup is available on each available runtime group. Setup
(or Renew) opens a dialog with Create a CSR and Install Certificate tabs. The
CSR can be copied and sent to the APS team; installation only requires pasting
the signed certificate and any intermediate certificates.

Configure `environments[].signing_root_ca_pem` in `config.yaml` with the trusted
root CA PEM for that exact runtime-group environment ID. The server supplies it
to the member API; the browser cannot override it. Installation reports a
configuration error if no root CA is configured. See
`samples/signing-environments.yaml` for certificates from the organization
signing guide, and merge them into the appropriate environment entries for your
deployment. Restart brochure-ui after changing configuration.

Before installing a certificate, brochure-ui retrieves the organization key set
for the environment and shows the registered edge runtimes. The user must
confirm the addition or replacement. It matches runtime certificates using the
organization/environment DNS SAN, replaces that runtime’s certificate, retains
the other certificate chains, and publishes the complete set. The server reads
the registry again on confirmation and requires another review if it changed.
Unrecognized certificates or registry errors stop the update rather than
assuming an empty set. Removal also retains certificates for other runtimes.
The upstream API has no conditional-write support, so concurrent updates after
the final registry read still require coordination.

Organization trust key sets offer **Verify Response** for consumers checking a provider’s response. Paste
`X-Edge-Token` and `X-Entity-Sig`, then select
**Check**. The dialog reuses Traffic’s signature and certificate-chain verifier
and displays each check plus Verified or Failed verification. The selected key
set fixes the organization and environment. Edge JWT `jwks_uri` values must
match that environment’s configured `jwks_urls`, or an edge key-set endpoint
under its configured `org_keysets_url`. Response header values are not logged.


### Privacy Zone directories

Set `privacy_zones_url` on each environment in `config.yaml` to override the JSON directory used to resolve privacy zone names in the Information Sharing Agreement.

| Environment | Default directory |
| --- | --- |
| Production | https://id.gov.bc.ca/oauth2/privacy-zones |
| Test and other non-production environments | https://idtest.gov.bc.ca/oauth2/privacy-zones |
| `apsdev` | https://idsit.gov.bc.ca/oauth2/privacy-zones |
