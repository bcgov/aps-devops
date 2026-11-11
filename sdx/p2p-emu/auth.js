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

// Every app API call uses the OAuth token, never the generated subject token.
export function requestApi(path, method, body, accessToken, request = fetch) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("App API requests must use a same-origin path.");
  }
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
  return request(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
    redirect: "error",
  });
}

const AUTH_SESSION_KEY = "p2p-emu.authorization";
export function saveAuthorization(storage, session) {
  storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}
export function clearSavedAuthorization(storage) {
  storage.removeItem(AUTH_SESSION_KEY);
}
export function restoreAuthorization(storage, now = Date.now()) {
  try {
    const session = JSON.parse(storage.getItem(AUTH_SESSION_KEY) || "null");
    if (
      session && typeof session.accessToken === "string" &&
      session.accessToken &&
      typeof session.clientId === "string" &&
      Number.isFinite(session.expiresAt) &&
      (session.expiresAt === 0 || session.expiresAt > now)
    ) return session;
  } catch { /* Invalid or unavailable storage is treated as signed out. */ }
  clearSavedAuthorization(storage);
  return null;
}
