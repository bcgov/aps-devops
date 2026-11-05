import { authorizeClient, requestApi } from "./auth.js";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
Deno.test("browser authorization posts credentials directly to OAuth endpoint", async () => {
  const request: typeof fetch = (url, init) => {
    assert(url === "https://identity.example/token");
    const options = init as RequestInit;
    const body = new URLSearchParams(String(options.body));
    assert(body.get("grant_type") === "client_credentials");
    assert(
      body.get("client_id") === "client" &&
        body.get("client_secret") === "secret",
    );
    assert(options.credentials === "omit" && options.redirect === "error");
    return Promise.resolve(
      Response.json({
        access_token: "access",
        token_type: "Bearer",
        expires_in: 300,
        refresh_token: "private",
      }),
    );
  };
  const result = await authorizeClient(
    "https://identity.example/token",
    "client",
    "secret",
    request,
  );
  assert(
    result.access_token === "access" && result.expires_in === 300 &&
      !("refresh_token" in result),
  );
});
Deno.test("browser authorization reports CORS and credential errors without exposing secrets", async () => {
  for (
    const request of [
      () => Promise.reject(new TypeError("Network failure")),
      () => Promise.resolve(new Response("secret", { status: 401 })),
      () => Promise.resolve(Response.json({ token_type: "Bearer" })),
    ]
  ) {
    let failed = false;
    try {
      await authorizeClient(
        "https://identity.example/token",
        "client",
        "secret",
        request,
      );
    } catch (error) {
      failed = true;
      assert(!(error as Error).message.includes("secret"));
    }
    assert(failed);
  }
});

Deno.test("profile and generation API requests all carry the OAuth bearer token", async () => {
  const calls: { path: unknown; method: string | undefined }[] = [];
  const request: typeof fetch = (path, init) => {
    const options = init as RequestInit;
    const headers = new Headers(options.headers);
    assert(headers.get("Authorization") === "Bearer oauth-access-token");
    assert(options.cache === "no-store" && options.redirect === "error");
    if (options.body) {
      assert(headers.get("Content-Type") === "application/json");
    }
    calls.push({ path, method: options.method });
    return Promise.resolve(
      Response.json({ access_token: "generated-subject-token" }),
    );
  };
  await requestApi(
    "/api/profiles",
    "GET",
    undefined,
    "oauth-access-token",
    request,
  );
  await requestApi(
    "/api/profiles",
    "POST",
    { user: "alice" },
    "oauth-access-token",
    request,
  );
  await requestApi(
    "/token",
    "POST",
    { profileId: "profile" },
    "oauth-access-token",
    request,
  );
  await requestApi(
    "/api/profiles/profile",
    "DELETE",
    undefined,
    "oauth-access-token",
    request,
  );
  // After generating a subject token, subsequent calls still use the OAuth token.
  await requestApi(
    "/api/profiles",
    "GET",
    undefined,
    "oauth-access-token",
    request,
  );
  assert(calls.length === 5);
  let blocked = false;
  try {
    await requestApi(
      "https://other.example/api",
      "GET",
      undefined,
      "oauth-access-token",
      request,
    );
  } catch {
    blocked = true;
  }
  assert(blocked && calls.length === 5);
});
