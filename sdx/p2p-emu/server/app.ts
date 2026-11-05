export interface Profile {
  id: string;
  initialAzp: string;
  clientSubsystem: string;
  user: string;
  scopes: string[];
}
export interface Config {
  issuer: string;
  clientId: string;
  tokenUrl?: string;
  dataDir: string;
  ttl: number;
}
const enc = new TextEncoder();
export function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll(
    "/",
    "_",
  ).replace(/=+$/, "");
}
function input(value: unknown): Omit<Profile, "id"> {
  if (!value || typeof value !== "object") {
    throw new Error("A profile object is required.");
  }
  const result = {} as Omit<Profile, "id">;
  for (
    const field of [
      "initialAzp",
      "clientSubsystem",
      "user",
    ] as const
  ) {
    const v = (value as Record<string, unknown>)[field];
    if (
      typeof v !== "string" || !v.trim() ||
      v.length > 256 ||
      /[\r\n\x00-\x1f\x7f-\uffff]/.test(v)
    ) {
      throw new Error(`${field} must be 1–256 printable ASCII characters.`);
    }
    result[field] = v.trim();
  }
  const scopes = (value as Record<string, unknown>).scopes ?? [];
  if (
    !Array.isArray(scopes) || scopes.length > 100 ||
    scopes.some((scope) =>
      typeof scope !== "string" ||
      !/^[\x21\x23-\x5b\x5d-\x7e]{1,256}$/.test(scope)
    )
  ) {
    throw new Error("scopes must be an array of up to 100 valid scope names.");
  }
  result.scopes = [...new Set(scopes)];
  return result;
}
export async function createApp(
  config: Config,
  html = "",
  catalogFetch: typeof fetch = fetch,
) {
  if (!Number.isInteger(config.ttl) || config.ttl < 1 || config.ttl > 86400) {
    throw new Error("ttl must be 1–86400 seconds.");
  }
  const issuer = config.issuer.replace(/\/$/, "");
  const issuerUrl = new URL(issuer);
  if (
    !["http:", "https:"].includes(issuerUrl.protocol) ||
    issuerUrl.pathname !== "/" || issuerUrl.search || issuerUrl.hash
  ) throw new Error("issuer must be an HTTP(S) origin.");
  await Deno.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const keyPath = `${config.dataDir}/signing-key.json`;
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(await Deno.readTextFile(keyPath));
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    await Deno.writeTextFile(keyPath, JSON.stringify(jwk), {
      mode: 0o600,
      createNew: true,
    });
  }
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const kid = b64(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        enc.encode(JSON.stringify({ e: jwk.e, kty: "RSA", n: jwk.n })),
      ),
    ),
  );
  const publicKey = {
    kty: "RSA",
    n: jwk.n,
    e: jwk.e,
    kid,
    alg: "RS256",
    use: "sig",
  };
  const profilesPath = `${config.dataDir}/profiles.json`;
  let profiles: Profile[] = [];
  try {
    profiles = JSON.parse(await Deno.readTextFile(profilesPath));
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  let queue = Promise.resolve();
  function mutate(change: (items: Profile[]) => Profile[]) {
    const operation = queue.then(async () => {
      const next = change(profiles);
      await Deno.writeTextFile(
        `${profilesPath}.tmp`,
        JSON.stringify(next, null, 2),
        { mode: 0o600 },
      );
      await Deno.rename(`${profilesPath}.tmp`, profilesPath);
      profiles = next;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  function json(
    body: unknown,
    status = 200,
    extra: Record<string, string> = {},
  ) {
    return Response.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...extra,
      },
    });
  }
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    try {
      if (req.method === "POST" || req.method === "DELETE") {
        if (
          req.headers.get("origin") &&
          req.headers.get("origin") !== issuerUrl.origin
        ) return json({ error: "Cross-origin writes are not allowed." }, 403);
        if (
          req.method === "POST" &&
          !req.headers.get("content-type")?.startsWith("application/json")
        ) return json({ error: "Use application/json." }, 415);
      }
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      if (
        req.method === "GET" &&
        url.pathname === "/.well-known/openid-configuration"
      ) {
        return json({
          issuer,
          jwks_uri: `${issuer}/jwks`,
          token_endpoint: `${issuer}/token`,
          id_token_signing_alg_values_supported: ["RS256"],
          grant_types_supported: [],
          response_types_supported: [],
          subject_types_supported: ["public"],
        });
      }
      if (req.method === "GET" && url.pathname === "/api/config") {
        return json({ tokenUrl: config.tokenUrl || "" });
      }
      if (req.method === "GET" && url.pathname === "/jwks") {
        return json({ keys: [publicKey] });
      }
      if (req.method === "GET" && url.pathname === "/api/catalog/services") {
        try {
          const response = await catalogFetch(
            "https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog/services",
            {
              signal: AbortSignal.timeout(10000),
              headers: { Accept: "application/json" },
            },
          );
          if (!response.ok) throw new Error("Catalog request failed");
          const services = await response.json();
          if (
            !Array.isArray(services) ||
            services.some((service) =>
              typeof service.name !== "string" ||
              typeof service.environment !== "string" ||
              (service.subsystem?.privacyZone != null &&
                typeof service.subsystem.privacyZone !== "string")
            )
          ) throw new Error("Invalid catalog response");
          return json(
            services.map((service) => ({
              name: service.name,
              title: service.title || service.name,
              environment: service.environment,
              privacyZone: service.subsystem?.privacyZone ?? "",
              scopes: [
                ...new Map<string, { name: string; description: string }>(
                  (service.operations ?? []).flatMap((
                    operation: {
                      scopes?: { name: string; description?: string }[];
                    },
                  ) => operation.scopes ?? [])
                    .filter((scope: { name: string }) =>
                      typeof scope.name === "string"
                    )
                    .map((scope: { name: string; description?: string }) =>
                      [scope.name, {
                        name: scope.name,
                        description: scope.description ?? "",
                      }] as const
                    ),
                ).values(),
              ],
            })),
          );
        } catch {
          return json({
            error: "Unable to load the service catalog. Please retry.",
          }, 502);
        }
      }
      if (req.method === "GET" && url.pathname === "/api/profiles") {
        return json(profiles);
      }
      if (req.method === "POST" && url.pathname === "/api/profiles") {
        const profile = { ...input(await req.json()), id: crypto.randomUUID() };
        await mutate((items) => [...items, profile]);
        return json(profile, 201);
      }
      if (
        req.method === "DELETE" && url.pathname.startsWith("/api/profiles/")
      ) {
        const id = url.pathname.slice("/api/profiles/".length);
        let found = false;
        await mutate((items) => {
          found = items.some((p) => p.id === id);
          return items.filter((p) => p.id !== id);
        });
        return json(
          found ? { ok: true } : { error: "Profile not found." },
          found ? 200 : 404,
        );
      }
      if (req.method === "POST" && url.pathname === "/token") {
        if (!config.clientId.trim()) {
          return json({
            error:
              "Set the P2P_CLIENT_ID environment variable before generating tokens.",
          }, 503);
        }
        const body = await req.json();
        const selectedProfile = body.profileId
          ? profiles.find((p) => p.id === body.profileId)
          : input(body);
        if (!selectedProfile) return json({ error: "Profile not found." }, 404);
        const profile = input(selectedProfile);
        const now = Math.floor(Date.now() / 1000);
        const claims = {
          iss: issuer,
          sub: profile.user,
          aud: config.clientId,
          iat: now,
          exp: now + config.ttl,
          jti: crypto.randomUUID(),
          ...(profile.scopes.length ? { scope: profile.scopes.join(" ") } : {}),
        };
        const unsigned = `${
          b64(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid })))
        }.${b64(enc.encode(JSON.stringify(claims)))}`;
        const signature = await crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          key,
          enc.encode(unsigned),
        );
        const token = `${unsigned}.${b64(new Uint8Array(signature))}`;
        const headers: Record<string, string> = {
          "X-SDX-Original-AZP": profile.initialAzp,
          "X-SDX-Client-Subsystem-Id": profile.clientSubsystem,
          "Correlation-Id": crypto.randomUUID(),
          Authorization: `Bearer ${token}`,
        };
        return json(
          {
            access_token: token,
            token_type: "Bearer",
            expires_in: config.ttl,
            claims,
            headers,
          },
          200,
          { Pragma: "no-cache" },
        );
      }
      return json({ error: "Not found." }, 404);
    } catch (err) {
      if (
        err instanceof SyntaxError ||
        (err instanceof Error && /must be|required/.test(err.message))
      ) return json({ error: (err as Error).message }, 400);
      console.error(err);
      return json({ error: "Request failed." }, 500);
    }
  };
}
