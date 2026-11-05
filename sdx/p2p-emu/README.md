# P2P Emulator

A standalone Deno micro-app, alongside `sdx-playground-login`, for generating
RS256 access tokens and managing reusable user profiles.

Run `deno task start` in this directory and open http://localhost:8000. No
external packages are required. Run `deno task start`. Optionally copy
`config.local.json.example` to `config.local.json`. Set `issuer` to the
externally reachable origin used by token validators. Set `hostname` to
`0.0.0.0` for containers and mount configuration and a persistent writable
`/app/data` volume.

The UI accepts Initial AZP and Client Subsystem in a Client section, plus
subject identifier and zero or more scopes, and generates tokens, shows claims
and request headers, and saves, loads, and deletes profiles. The subject
identifier becomes `sub`. Tokens contain `iss`, `sub`, `iat`, `exp`, and `jti`,
plus `scope` when selected. The subject identifier and privacy zone are not
added as custom token claims. Default lifetime is 300 seconds (five minutes). No
`aud` claim is emitted.

## Endpoints

- `GET /.well-known/openid-configuration`: issuer metadata with `jwks_uri` and
  token endpoint.
- `GET /jwks`: public RSA key with matching JWT `kid`.
- `POST /token`: JSON containing `initialAzp`, `clientSubsystem`, `user`,
  `privacyZone`, and optional `scopes`, or a saved `profileId`. Returns
  `access_token`, `token_type`, `expires_in`, `claims`, and request `headers`.
- `GET /api/profiles`: list saved profiles.
- `POST /api/profiles`: save the profile fields and scope selections.
- `DELETE /api/profiles/:id`: delete a profile.

Example:

```sh
curl http://localhost:8000/token -H 'Content-Type: application/json' \
  -d '{"initialAzp":"original-client","clientSubsystem":"MIN.TEST.CLIENT","user":"alice","scopes":["nrs:widgets:read"]}'
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

## Scopes

Enter zero or more scope names separated by spaces or new lines. No service or
environment details are required. Scopes are entered directly; the form does not
depend on the catalog. Scopes are saved and restored with the profile.
Previously saved profiles still load; old service/environment/privacy-zone
fields are ignored when saving or generating a token.

`POST /token` and `POST /api/profiles` accept an optional `scopes` array of
scope names. Selected names become a space-separated `scope` claim in the signed
JWT; the claim is omitted when none are selected. Older profiles default to no
scopes. The emulator validates scope syntax but permits supplied scopes
independently of catalog availability. The four generated request headers remain
unchanged.

## Image builds

`.github/workflows/p2p-emu.yaml` checks and tests the app, then uses the shared
image build workflow for Linux amd64 and arm64. Relevant feature/dev pushes and
manual runs publish `ghcr.io/bcgov/aps-devops/p2p-emu:sha-<commit>`; pushes also
refresh the sanitized branch alias (for example `feature-p2p-emu`). Pull
requests build without publishing. Local profiles, configuration, and signing
keys are excluded from the Docker build context.

## Frontend authorization

Set `P2P_TOKEN_URL` to the OAuth token endpoint and restart the app. The
banner's Authorize button accepts Client ID and Client Secret. The browser posts
them directly to the configured token endpoint using `client_credentials` and
form-encoded `client_id`/`client_secret`. The endpoint must use HTTPS, except
for local development on localhost.

The frontend keeps the returned access token in tab-scoped session storage and
attaches `Authorization: Bearer ...` to this app's API calls (including profile
operations and token generation). Refresh restores authorization until expiry.
Clear authorization removes it; closing the tab ends its storage session.
Browsers that restore previous sessions may restore session storage as well.
Credentials are not persisted; the secret field is cleared after each exchange.
Expired tokens require reauthorization. The OAuth token is separate from the
emulator's generated subject token. The endpoint must allow this app’s origin
through CORS. The app server exposes only the public token URL via
`GET /api/config` and never receives the client credentials. This adds frontend
authorization headers; it does not add token verification or access enforcement
to the emulator backend.

`P2P_TOKEN_URL` is environment-only and displayed read-only in the Authorize
dialog. Direct Deno invocations must allow both variables:
`--allow-env=P2P_CLIENT_ID,P2P_TOKEN_URL`.

Write requests with an Origin header must match the configured `issuer` origin.
Behind HTTPS termination, set `issuer` to the public HTTPS origin; the internal
HTTP scheme does not affect this check. Forwarded headers do not override it.
