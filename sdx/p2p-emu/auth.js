// Runs in the browser: credentials go directly to the configured OAuth endpoint.
export async function authorizeClient(
  tokenUrl,
  clientId,
  clientSecret,
  request = fetch,
) {
  if (!tokenUrl) throw new Error("Set P2P_TOKEN_URL before authorizing.");
  const endpoint = new URL(tokenUrl);
  if (
    endpoint.protocol !== "https:" &&
    !(endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
  ) {
    throw new Error("The token endpoint must use HTTPS.");
  }
  let response;
  try {
    response = await request(endpoint.href, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId.trim(),
        client_secret: clientSecret,
      }),
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "Unable to reach the token endpoint. Check connectivity and whether its CORS policy allows this app's origin.",
    );
  }
  if (!response.ok) {
    throw new Error(
      "Authorization failed. Check the client credentials and token endpoint.",
    );
  }
  const result = await response.json();
  if (
    typeof result.access_token !== "string" || !result.access_token ||
    /[\r\n]/.test(result.access_token) ||
    (result.token_type && String(result.token_type).toLowerCase() !== "bearer")
  ) {
    throw new Error("Token endpoint did not return a Bearer access token.");
  }
  return {
    access_token: result.access_token,
    expires_in: typeof result.expires_in === "number" && result.expires_in > 0
      ? result.expires_in
      : null,
  };
}
