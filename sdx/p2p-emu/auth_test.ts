import { authorizeClient } from "./auth.js";
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
