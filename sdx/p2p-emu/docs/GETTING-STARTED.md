# Getting started with the P2P Emulator API

These examples use Bash, `curl`, and `jq`. Follow steps 1–4 in the same shell
for the default journey. Profile management is optional. Replace the example
client credentials and profile values with your own. The examples use the
deployed development app. Keep `P2P_BASE_URL` without a trailing slash.

There are two separate access tokens:

- **OAuth access token**: obtained from LoginProxy and sent when calling the
  emulator API.
- **Generated subject token**: minted by the emulator for a profile and returned
  with headers for a downstream request. It expires after 300 seconds by
  default.

## 1. Configure the URLs

```bash
P2P_BASE_URL='https://sdx-p2p-emu-api-gov-bc-ca.dev.api.gov.bc.ca'
TOKEN_URL='https://dev.loginproxy.gov.bc.ca/auth/realms/apigw/protocol/openid-connect/token'
```

The emulator publishes these verification endpoints:

- OIDC discovery:
  <https://sdx-p2p-emu-api-gov-bc-ca.dev.api.gov.bc.ca/.well-known/openid-configuration>
- JWKS: <https://sdx-p2p-emu-api-gov-bc-ca.dev.api.gov.bc.ca/jwks>

`TOKEN_URL` above is the LoginProxy endpoint used for client-credentials
authorization; it is separate from the emulator's discovery and JWKS endpoints.

## 2. Authorize with client credentials

Enter the Client ID and Client Secret used to access the emulator API. The
secret prompt does not echo input or put the value in shell history.

```bash
read -r -p 'Client ID: ' CLIENT_ID
read -r -s -p 'Client Secret: ' CLIENT_SECRET
printf '\n'

OAUTH_RESPONSE=$(curl --fail-with-body --silent --show-error \
  --request POST "$TOKEN_URL" \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --header 'Accept: application/json' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET")

OAUTH_ACCESS_TOKEN=$(printf '%s' "$OAUTH_RESPONSE" | jq -er '.access_token')
printf '%s' "$OAUTH_RESPONSE" | jq '{token_type, expires_in}'
unset CLIENT_SECRET OAUTH_RESPONSE
```

This calls LoginProxy directly, just like the browser Authorize dialog. There is
no server-side `/api/authorize` endpoint. Repeat this step when the OAuth token
expires. Its lifetime is controlled by LoginProxy, independently of generated
subject tokens. Browser CORS rules do not apply to curl.

## 3. Generate a token without saving a profile

This is the default journey: pass the subject and client context directly to
`POST /token`. Nothing is saved as a profile.

`user` is the subject identifier and becomes the generated token's `sub` claim.
`initialAzp` and `clientSubsystem` supply downstream request headers. `scopes`
is an array of zero or more scope names; use `[]` for no scopes, or omit it.
Service, environment, and privacy zone are not required.

```bash
TOKEN_RESPONSE=$(curl --fail-with-body --silent --show-error \
  --request POST "$P2P_BASE_URL/token" \
  --header "Authorization: Bearer $OAUTH_ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "initialAzp": "example-original-client",
  "clientSubsystem": "MIN.TEST.CLIENT",
  "user": "example-subject",
  "scopes": ["nrs:widgets:read", "nrs:widgets:create"]
}
JSON
)

printf '%s' "$TOKEN_RESPONSE" | jq '{token_type, expires_in, claims, headers}'
SUBJECT_ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | jq -er '.access_token')
```

The response includes `access_token`, `token_type: "Bearer"`, `expires_in: 300`
with the default configuration, `claims`, and `headers`. The signed JWT contains
`iss`, `sub`, `azp`, `iat`, `exp`, `jti`, and a space-separated `scope` when
scopes were selected. It does not contain `aud`, `service`, `environment`,
`user`, or `privacy_zone` claims. With no scopes, the `scope` claim is omitted.

## 4. Use the generated headers downstream

Set the target API URL. This example uses the token response from step 3 and
sends its five request headers. The emulator does not forward this request for
you.

```bash
TARGET_API_URL='https://your-api.example/widgets'
ORIGINAL_AZP=$(printf '%s' "$TOKEN_RESPONSE" | jq -er '.headers["X-SDX-Original-AZP"]')
CLIENT_SUBSYSTEM=$(printf '%s' "$TOKEN_RESPONSE" | jq -er '.headers["X-SDX-Client-Subsystem-Id"]')
CORRELATION_ID=$(printf '%s' "$TOKEN_RESPONSE" | jq -er '.headers["Correlation-Id"]')
EDGE_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | jq -er '.headers["X-Edge-Token"]')

curl --fail-with-body --silent --show-error \
  "$TARGET_API_URL" \
  --header "X-SDX-Original-AZP: $ORIGINAL_AZP" \
  --header "X-SDX-Client-Subsystem-Id: $CLIENT_SUBSYSTEM" \
  --header "Correlation-Id: $CORRELATION_ID" \
  --header "X-Edge-Token: $EDGE_TOKEN" \
  --header "Authorization: Bearer $SUBJECT_ACCESS_TOKEN"
```

Each token generation produces a fresh correlation UUID. Continue using
`OAUTH_ACCESS_TOKEN`, rather than `SUBJECT_ACCESS_TOKEN`, for emulator API
calls.

## 5. Discovery and public signing keys

```bash
curl --fail-with-body --silent --show-error \
  "$P2P_BASE_URL/.well-known/openid-configuration" | jq .

curl --fail-with-body --silent --show-error \
  "$P2P_BASE_URL/jwks" | jq .
```

Discovery describes the emulator's generated-token issuer, not LoginProxy. JWKS
exposes only the public signing key; its `kid` matches generated JWT headers.

The independent P2P origin issuer publishes its own discovery and signing keys:

```bash
curl --fail-with-body --silent --show-error \
  "$P2P_BASE_URL/p2p-origin/.well-known/openid-configuration" | jq .

curl --fail-with-body --silent --show-error \
  "$P2P_BASE_URL/p2p-origin/jwks" | jq .
```

Each token response includes `headers["X-Edge-Token"]`, whose signed payload
contains only `iss`, `jti`, `request_id`, `iat`, and `exp`. Validate this token
against the origin JWKS rather than the subject-token JWKS. Its default lifetime
is 300 seconds.

## Optional: save and reuse profiles

Use profiles when you want to persist subject, client, and scope values for
later reuse.

### Create a profile

```bash
PROFILE_RESPONSE=$(curl --fail-with-body --silent --show-error \
  --request POST "$P2P_BASE_URL/api/profiles" \
  --header "Authorization: Bearer $OAUTH_ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "initialAzp": "example-original-client",
  "clientSubsystem": "MIN.TEST.CLIENT",
  "user": "example-subject",
  "scopes": ["nrs:widgets:read", "nrs:widgets:create"]
}
JSON
)

printf '%s' "$PROFILE_RESPONSE" | jq .
PROFILE_ID=$(printf '%s' "$PROFILE_RESPONSE" | jq -er '.id')
```

A successful create returns HTTP 201 with the saved profile and its generated
`id`. Profiles persist across app restarts.

### List and load profiles

```bash
curl --fail-with-body --silent --show-error \
  "$P2P_BASE_URL/api/profiles" \
  --header "Authorization: Bearer $OAUTH_ACCESS_TOKEN" | jq .
```

The API returns the complete profiles. To select a single profile from the list:

```bash
curl --fail-with-body --silent --show-error \
  "$P2P_BASE_URL/api/profiles" \
  --header "Authorization: Bearer $OAUTH_ACCESS_TOKEN" \
  | jq --arg id "$PROFILE_ID" '.[] | select(.id == $id)'
```

There is no separate GET-by-ID endpoint. The UI's Load action fills the form
from the profile list.

### Generate a token from a saved profile

```bash
TOKEN_RESPONSE=$(jq -n --arg id "$PROFILE_ID" '{profileId: $id}' \
  | curl --fail-with-body --silent --show-error \
    --request POST "$P2P_BASE_URL/token" \
    --header "Authorization: Bearer $OAUTH_ACCESS_TOKEN" \
    --header 'Content-Type: application/json' \
    --data-binary @-)

printf '%s' "$TOKEN_RESPONSE" | jq '{token_type, expires_in, claims, headers}'
SUBJECT_ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | jq -er '.access_token')
```

### Delete the example profile

```bash
curl --fail-with-body --silent --show-error \
  --request DELETE "$P2P_BASE_URL/api/profiles/$PROFILE_ID" \
  --header "Authorization: Bearer $OAUTH_ACCESS_TOKEN" | jq .
```

Success returns `{"ok":true}`. A missing profile returns HTTP 404.

## Troubleshooting

- **HTTP 400**: check required string fields and that `scopes` is an array of
  individual scope names, without whitespace inside a name.
- **HTTP 401/403 from the deployment gateway**: authorize again and confirm the
  OAuth client has the required API permissions. The standalone emulator does
  not itself validate OAuth access tokens; gateway enforcement is separate.
- **“Cross-origin writes are not allowed.”**: if sending an `Origin` header, it
  must exactly match the public origin configured as the emulator's `issuer`.
  These curl examples omit `Origin`. Behind TLS termination, configure `issuer`
  with the public HTTPS origin.
- **Unexpected token lifetime**: `expires_in` and JWT `exp` use the app's `ttl`
  configuration. The default is 300 seconds.

Clear shell variables after finishing:

```bash
unset OAUTH_ACCESS_TOKEN SUBJECT_ACCESS_TOKEN EDGE_TOKEN TOKEN_RESPONSE PROFILE_RESPONSE
```

The main JWT’s `azp` is the app’s `P2P_CLIENT_ID`, such as `sdx-edge-gw`, rather
than the profile’s `initialAzp`.

Each edge token has a fresh UUID `request_id`, generated independently of both
its `jti` and the `Correlation-Id` header.
