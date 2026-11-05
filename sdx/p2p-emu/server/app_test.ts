import { createApp } from "./app.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("token verification and persistent profile lifecycle", async () => {
  const dataDir = await Deno.makeTempDir();
  try {
    const config = {
      issuer: "http://localhost:8000",
      clientId: "p2p-test-client",
      dataDir,
      ttl: 300,
    };
    const missingClient = await createApp({ ...config, clientId: "" });
    assert(
      (await missingClient(
        new Request(config.issuer + "/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      )).status === 503,
    );
    let app = await createApp(config);
    const req = (path: string, method = "GET", body?: unknown) =>
      app(
        new Request(config.issuer + path, {
          method,
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
    const profile = {
      initialAzp: "original-client",
      clientSubsystem: "MIN.TEST.CLIENT",
      user: "alice",
      scopes: ["widgets:read", "widgets:write", "widgets:read"],
    };
    const saved = await (await req("/api/profiles", "POST", profile)).json();
    app = await createApp(config);
    assert((await (await req("/api/profiles")).json())[0].id === saved.id);
    const discovery = await (await req("/.well-known/openid-configuration"))
      .json();
    assert(discovery.jwks_uri === config.issuer + "/jwks");
    const response = await req("/token", "POST", { profileId: saved.id });
    assert(response.headers.get("cache-control") === "no-store");
    const token = await response.json();
    assert(token.claims.scope === "widgets:read widgets:write");
    assert(token.expires_in === 300);
    assert(token.claims.azp === config.clientId);
    for (const field of ["service", "environment", "user", "privacy_zone"]) {
      assert(!(field in token.claims));
    }
    const persisted = await (await req("/api/profiles")).json();
    assert(persisted[0].scopes.join(" ") === "widgets:read widgets:write");
    assert(
      !("service" in persisted[0]) && !("environment" in persisted[0]) &&
        !("privacyZone" in persisted[0]),
    );
    const noScopes =
      await (await req("/token", "POST", { ...profile, scopes: [] })).json();
    assert(!("scope" in noScopes.claims));
    const legacy = await req("/token", "POST", {
      ...profile,
      service: "old-service",
      environment: "dev",
    });
    assert(legacy.status === 200);
    for (
      const scopes of ["widgets:read", ["bad scope"], [12], ["bad\nvalue"]]
    ) {
      assert(
        (await req("/token", "POST", { ...profile, scopes })).status === 400,
      );
    }
    assert(token.headers.Authorization === "Bearer " + token.access_token);
    assert(token.headers["X-SDX-Original-AZP"] === "original-client");
    assert(token.headers["X-SDX-Client-Subsystem-Id"] === "MIN.TEST.CLIENT");
    assert(
      Object.keys(token.headers).join(",") ===
        "X-SDX-Original-AZP,X-SDX-Client-Subsystem-Id,Correlation-Id,Authorization,X-Edge-Token",
    );
    assert(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        .test(token.headers["Correlation-Id"]),
    );
    const second = await (await req("/token", "POST", { profileId: saved.id }))
      .json();
    assert(
      second.headers["Correlation-Id"] !== token.headers["Correlation-Id"],
    );
    assert(
      (await req("/token", "POST", { ...profile, initialAzp: "" })).status ===
        400,
    );
    assert(
      (await req("/token", "POST", {
        ...profile,
        clientSubsystem: "x\r\ninjected",
      })).status === 400,
    );
    assert(
      !("aud" in token.claims) && token.claims.sub === "alice" &&
        token.claims.exp - token.claims.iat === 300,
    );
    const jwks = await (await req("/jwks")).json();
    assert(!jwks.keys[0].d && !jwks.keys[0].p);
    const originDiscovery =
      await (await req("/p2p-origin/.well-known/openid-configuration")).json();
    const originKeys = await (await req("/p2p-origin/jwks")).json();
    assert(originDiscovery.issuer === config.issuer + "/p2p-origin");
    assert(originDiscovery.jwks_uri === config.issuer + "/p2p-origin/jwks");
    assert(
      originKeys.keys[0].kid !== jwks.keys[0].kid && !originKeys.keys[0].d,
    );
    const [header, payload, signature] = token.access_token.split(".");
    const decode = (v: string) =>
      Uint8Array.from(
        atob(v.replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      );
    assert(
      JSON.parse(new TextDecoder().decode(decode(header))).kid ===
        jwks.keys[0].kid,
    );
    assert(
      JSON.parse(new TextDecoder().decode(decode(payload))).scope ===
        "widgets:read widgets:write",
    );
    const [edgeHeader, edgePayload, edgeSignature] = token
      .headers["X-Edge-Token"].split(".");
    assert(
      JSON.parse(new TextDecoder().decode(decode(payload))).azp ===
        config.clientId,
    );
    const edgeClaims = JSON.parse(
      new TextDecoder().decode(decode(edgePayload)),
    );
    assert(
      Object.keys(edgeClaims).sort().join(",") === "exp,iat,iss,jti,request_id",
    );
    assert(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        .test(edgeClaims.request_id),
    );
    assert(edgeClaims.request_id !== token.headers["Correlation-Id"]);
    assert(edgeClaims.request_id !== edgeClaims.jti);
    assert(edgeClaims.request_id !== second.origin_claims.request_id);
    assert(
      edgeClaims.iss === originDiscovery.issuer &&
        edgeClaims.exp - edgeClaims.iat === 300,
    );
    assert(
      JSON.parse(new TextDecoder().decode(decode(edgeHeader))).kid ===
        originKeys.keys[0].kid,
    );
    const edgeKey = await crypto.subtle.importKey(
      "jwk",
      originKeys.keys[0],
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    assert(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        edgeKey,
        decode(edgeSignature),
        new TextEncoder().encode(edgeHeader + "." + edgePayload),
      ),
    );
    assert(
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        edgeKey,
        decode(signature),
        new TextEncoder().encode(header + "." + payload),
      )),
    );
    const key = await crypto.subtle.importKey(
      "jwk",
      jwks.keys[0],
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    assert(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        decode(signature),
        new TextEncoder().encode(header + "." + payload),
      ),
    );
    app = await createApp(config);
    assert(
      (await (await req("/p2p-origin/jwks")).json()).keys[0].kid ===
        originKeys.keys[0].kid,
    );
    assert(
      (await (await req("/jwks")).json()).keys[0].kid === jwks.keys[0].kid,
    );
    assert((await req("/token", "POST", {})).status === 400);
    assert(
      (await req("/token", "POST", { ...profile, user: "alice\r\ninjected" }))
        .status === 400,
    );
    assert(
      (await req("/token", "POST", { profileId: "missing" })).status === 404,
    );
    assert(
      (await app(
        new Request(config.issuer + "/api/profiles/" + saved.id, {
          method: "DELETE",
          headers: { Origin: "http://other.test" },
        }),
      )).status === 403,
    );
    assert((await req("/api/profiles/" + saved.id, "DELETE")).status === 200);
    app = await createApp(config);
    assert((await (await req("/api/profiles")).json()).length === 0);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => req("/api/profiles", "POST", profile)),
    );
    assert(results.every((r) => r.status === 201));
    app = await createApp(config);
    assert((await (await req("/api/profiles")).json()).length === 6);
  } finally {
    await Deno.remove(dataDir, { recursive: true });
  }
});

Deno.test("catalog mapping, missing privacy zones, and upstream failures", async () => {
  const dataDir = await Deno.makeTempDir();
  try {
    const config = {
      issuer: "http://localhost:8000",
      clientId: "p2p-test-client",
      dataDir,
      ttl: 300,
    };
    const fakeFetch: typeof fetch = () =>
      Promise.resolve(Response.json([
        {
          name: "SERVICE.A",
          title: "A",
          environment: "apsdev",
          subsystem: { privacyZone: "urn:zone:a" },
          operations: [
            { scopes: [{ name: "widgets:read", description: "Read widgets" }] },
            {
              scopes: [{ name: "widgets:read", description: "Read widgets" }, {
                name: "widgets:write",
                description: "Write widgets",
              }],
            },
          ],
        },
        {
          name: "SERVICE.B",
          title: "B",
          environment: "apstst",
          subsystem: { privacyZone: null },
        },
      ]));
    const app = await createApp(config, "", fakeFetch);
    const response = await app(
      new Request(config.issuer + "/api/catalog/services"),
    );
    const services = await response.json();
    assert(
      services[0].privacyZone === "urn:zone:a" &&
        services[0].environment === "apsdev",
    );
    assert(services[1].privacyZone === "");
    assert(
      services[0].scopes.length === 2 &&
        services[0].scopes[0].name === "widgets:read",
    );
    assert(services[1].scopes.length === 0);
    const token = await app(
      new Request(config.issuer + "/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialAzp: "original-client",
          clientSubsystem: "MIN.TEST.CLIENT",
          user: "alice",
        }),
      }),
    );
    assert(token.status === 200);
    assert(!("scope" in (await token.json()).claims));
    const failing = await createApp(
      config,
      "",
      () => Promise.resolve(new Response("Unavailable", { status: 503 })),
    );
    assert(
      (await failing(new Request(config.issuer + "/api/catalog/services")))
        .status === 502,
    );
  } finally {
    await Deno.remove(dataDir, { recursive: true });
  }
});

Deno.test("writes use configured public origin behind TLS termination", async () => {
  const dataDir = await Deno.makeTempDir();
  try {
    const app = await createApp({
      issuer: "https://p2p.example",
      clientId: "sdx-edge-gw",
      dataDir,
      ttl: 300,
    });
    const profile = {
      initialAzp: "client",
      clientSubsystem: "subsystem",
      user: "alice",
      scopes: [],
    };
    const write = (origin: string) =>
      app(
        new Request("http://p2p-emu:8000/api/profiles", {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        }),
      );
    const created = await write("https://p2p.example");
    assert(created.status === 201);
    const saved = await created.json();
    for (
      const origin of [
        "https://attacker.example",
        "http://p2p.example",
        "https://p2p.example:8443",
        "null",
      ]
    ) {
      assert((await write(origin)).status === 403);
    }
    const token = await app(
      new Request("http://p2p-emu:8000/token", {
        method: "POST",
        headers: {
          Origin: "https://p2p.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileId: saved.id }),
      }),
    );
    assert(token.status === 200);
    const removed = await app(
      new Request("http://p2p-emu:8000/api/profiles/" + saved.id, {
        method: "DELETE",
        headers: { Origin: "https://p2p.example" },
      }),
    );
    assert(removed.status === 200);
    const spoofed = await app(
      new Request("http://p2p-emu:8000/api/profiles", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "X-Forwarded-Host": "attacker.example",
          "X-Forwarded-Proto": "https",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      }),
    );
    assert(spoofed.status === 403);
  } finally {
    await Deno.remove(dataDir, { recursive: true });
  }
});
