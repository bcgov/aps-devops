# P2P Emulator

A standalone Deno micro-app, alongside `sdx-playground-login`, for generating
RS256 access tokens and managing reusable user profiles.

Run `deno task start` in this directory and open http://localhost:8000. No
external packages or environment variables are required. Optionally copy
`config.local.json.example` to `config.local.json`. Set `issuer` to the
externally reachable origin used by token validators. Set `hostname` to
`0.0.0.0` for containers and mount configuration and a persistent writable
`/app/data` volume.

The UI accepts Initial AZP and Client Subsystem in a Client section, plus
service, environment, user, and privacy zone, and generates tokens, shows claims
and request headers, and saves, loads, and deletes profiles. `P2P_CLIENT_ID`
becomes `aud`; the subject identifier becomes `sub`. Tokens contain `iss`,
`sub`, `aud`, `iat`, `exp`, and `jti`, plus `scope` when selected. Service,
environment, user, and privacy zone remain profile fields and are not added as
custom token claims. Default lifetime is one hour.

## Endpoints

- `GET /.well-known/openid-configuration`: issuer metadata with `jwks_uri` and
  token endpoint.
- `GET /jwks`: public RSA key with matching JWT `kid`.
- `POST /token`: JSON containing `initialAzp`, `clientSubsystem`, `service`,
  `environment`, `user`, `privacyZone`, or a saved `profileId`. Returns
  `access_token`, `token_type`, `expires_in`, `claims`, and request `headers`.
- `GET /api/profiles`: list saved profiles.
- `POST /api/profiles`: save all six profile fields.
- `DELETE /api/profiles/:id`: delete a profile.

Example:

```sh
curl http://localhost:8000/token -H 'Content-Type: application/json' \
  -d '{"initialAzp":"original-client","clientSubsystem":"MIN.TEST.CLIENT","service":"example-api","environment":"dev","user":"alice","privacyZone":"zone-a"}'
```

Token responses use `Cache-Control: no-store` and `Pragma: no-cache`. The
`headers` object contains exactly these four headers, in order:

- `X-SDX-Original-AZP`: the profile's Initial AZP.
- `X-SDX-Client-Subsystem-Id`: the profile's Client Subsystem.
- `Correlation-Id`: a fresh UUID for each generation.
- `Authorization`: `Bearer <access_token>`.

The app displays these for callers; it does not forward service requests. These
request headers are separate from the HTTP response's JSON/cache headers.
Existing profiles without client fields can be loaded; fill in the Client
section and save a new profile before generating a token. Client values are
persisted with the profile and are used as headers, without adding new token
claims.

The private signing key is generated once and stored as `data/signing-key.json`
with owner-only permissions. JWKS contains only public parameters. Profiles are
persisted atomically to `data/profiles.json`. Preserve the data directory across
restarts to preserve signatures and profiles. Run one app instance per data
directory.

This is a development token issuer with no authentication; anyone with access
can mint identities and manage profiles. It binds to loopback by default.
Discovery and JWKS support JWT verification; this is not an interactive OIDC
authorization server and does not implement login, authorization-code flows, or
OAuth client authentication.

Run `deno task test` and `deno check main.ts` for verification.

## Service catalog

The Service section loads the live SDX catalog through
`GET /api/catalog/services`, which fetches
https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog/services on the
server. Selecting a service uses its `name` as the profile service,
`environment` as the environment, and `subsystem.privacyZone` as the privacy
zone. Services without a privacy zone show “No privacy zone configured” and use
an empty privacy zone. The User section remains independent; both sections save
together as a single profile. Previously saved profiles retain their saved
values when loaded, including services no longer in the catalog. Catalog
failures show a retry control without preventing saved-profile token generation.

## Scopes

The Scopes section lists the selected service's unique operation scopes, with
checkboxes and descriptions. Select any subset (none by default). Selections are
saved in the profile's `scopes` array and restored when loaded. Changing
services clears the previous selections. Saved scopes absent from the current
catalog are labeled explicitly and can be unchecked.

`POST /token` and `POST /api/profiles` accept an optional `scopes` array of
scope names. Selected names become a space-separated `scope` claim in the signed
JWT; the claim is omitted when none are selected. Older profiles default to no
scopes. The emulator validates scope syntax but permits supplied scopes
independently of catalog availability. The four generated request headers remain
unchanged.

`P2P_CLIENT_ID` is read from the process environment at startup and cannot be
overridden by local JSON configuration. Restart the app after changing it. Deno
tasks grant access only to this environment variable. For containers, supply it
with `-e P2P_CLIENT_ID=your-client-id`.

## Image builds

`.github/workflows/p2p-emu.yaml` checks and tests the app, then uses the shared
image build workflow for Linux amd64 and arm64. Relevant feature/dev pushes and
manual runs publish `ghcr.io/bcgov/aps-devops/p2p-emu:sha-<commit>`; pushes also
refresh the sanitized branch alias (for example `feature-p2p-emu`). Pull
requests build without publishing. Local profiles, configuration, and signing
keys are excluded from the Docker build context.
