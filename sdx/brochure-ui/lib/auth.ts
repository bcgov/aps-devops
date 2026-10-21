import * as oauth from "oauth4webapi";

const ISSUER = Deno.env.get("OIDC_ISSUER");
const CLIENT_ID = Deno.env.get("OIDC_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("OIDC_CLIENT_SECRET");
const OVERRIDE_REDIRECT = Deno.env.get("OIDC_REDIRECT_URI");
const SCOPES = Deno.env.get("OIDC_SCOPES") ?? "openid profile email";
const SESSION_SECRET = Deno.env.get("SESSION_SECRET") ?? "";

export const authEnabled = !!(
  ISSUER &&
  CLIENT_ID &&
  CLIENT_SECRET &&
  SESSION_SECRET
);

const SESSION_COOKIE = "sdx_session";
const AUTH_COOKIE = "sdx_auth";
const SESSION_TTL = 60 * 60 * 8; // 8h

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  exp: number;
  accessToken?: string;
}

let asPromise: Promise<oauth.AuthorizationServer> | null = null;
function getAs(): Promise<oauth.AuthorizationServer> {
  if (!asPromise) {
    const issuer = new URL(ISSUER!);
    asPromise = oauth
      .discoveryRequest(issuer)
      .then((res) => oauth.processDiscoveryResponse(issuer, res));
  }
  return asPromise;
}

function client(): oauth.Client {
  return {
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    token_endpoint_auth_method: "client_secret_basic",
  };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      enc.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return payload + "." + b64u(sig);
}

async function verify(token: string): Promise<string | null> {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const key = await getKey();
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64uDecode(sig),
      enc.encode(payload),
    );
  } catch {
    return null;
  }
  return ok ? payload : null;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function publicBase(req: Request): URL {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host");
  if (proto) url.protocol = proto.split(",")[0].trim() + ":";
  if (host) url.host = host.split(",")[0].trim();
  return url;
}

function cookieFlags(req: Request): string {
  const secure = publicBase(req).protocol === "https:" ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function redirectUri(req: Request): string {
  if (OVERRIDE_REDIRECT) return OVERRIDE_REDIRECT;
  return new URL("/auth/callback", publicBase(req)).toString();
}

export async function getCurrentUser(
  req: Request,
): Promise<SessionUser | null> {
  if (!authEnabled) return null;
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = await verify(token);
  if (!payload) return null;
  try {
    const data = JSON.parse(dec.decode(b64uDecode(payload))) as SessionUser;
    if (data.exp && Math.floor(Date.now() / 1000) > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function startLogin(
  req: Request,
  returnTo: string,
): Promise<Response> {
  const as = await getAs();
  const state = oauth.generateRandomState();
  const code_verifier = oauth.generateRandomCodeVerifier();
  const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);

  const url = new URL(as.authorization_endpoint!);
  url.searchParams.set("client_id", CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", code_challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const authStateRaw = b64u(
    enc.encode(JSON.stringify({ state, code_verifier, returnTo })),
  );
  const signed = await sign(authStateRaw);
  const cookie = `${AUTH_COOKIE}=${signed}${cookieFlags(req)}; Max-Age=600`;

  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      "set-cookie": cookie,
    },
  });
}

export async function completeLogin(req: Request): Promise<Response> {
  const cookies = parseCookies(req.headers.get("cookie"));
  const rawAuth = cookies[AUTH_COOKIE];
  if (!rawAuth) {
    return new Response("missing auth state", { status: 400 });
  }
  const payload = await verify(rawAuth);
  if (!payload) {
    return new Response("invalid auth state", { status: 400 });
  }
  let st: { state: string; code_verifier: string; returnTo: string };
  try {
    st = JSON.parse(dec.decode(b64uDecode(payload)));
  } catch {
    return new Response("bad auth state", { status: 400 });
  }

  const as = await getAs();
  const c = client();
  const url = new URL(req.url);
  const params = oauth.validateAuthResponse(as, c, url.searchParams, st.state);
  if (oauth.isOAuth2Error(params)) {
    return new Response("oauth error", { status: 400 });
  }

  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    as,
    c,
    params,
    redirectUri(req),
    st.code_verifier,
  );
  const result = await oauth.processAuthorizationCodeOpenIDResponse(
    as,
    c,
    tokenResponse,
  );
  if (oauth.isOAuth2Error(result)) {
    return new Response("token exchange failed", { status: 400 });
  }
  const claims = oauth.getValidatedIdTokenClaims(result);
  if (!claims) {
    return new Response("no id token claims", { status: 400 });
  }

  const exp =
    typeof claims.exp === "number"
      ? claims.exp
      : Math.floor(Date.now() / 1000) + SESSION_TTL;
  const accessToken =
    typeof result.access_token === "string" ? result.access_token : undefined;
  const user: SessionUser = {
    sub: String(claims.sub),
    name: typeof claims.name === "string" ? claims.name : undefined,
    email: typeof claims.email === "string" ? claims.email : undefined,
    preferred_username:
      typeof claims.preferred_username === "string"
        ? claims.preferred_username
        : undefined,
    exp: Math.min(exp, Math.floor(Date.now() / 1000) + SESSION_TTL),
    accessToken,
  };

  const sessionPayload = b64u(enc.encode(JSON.stringify(user)));
  const sessionToken = await sign(sessionPayload);
  const maxAge = Math.max(60, user.exp - Math.floor(Date.now() / 1000));

  const headers = new Headers();
  headers.append("location", st.returnTo || "/");
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${sessionToken}${cookieFlags(req)}; Max-Age=${maxAge}`,
  );
  headers.append("set-cookie", `${AUTH_COOKIE}=${cookieFlags(req)}; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

export async function logout(req: Request): Promise<Response> {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${cookieFlags(req)}; Max-Age=0`,
  );

  let location = "/";
  if (authEnabled) {
    try {
      const as = await getAs();
      if (as.end_session_endpoint) {
        const url = new URL(as.end_session_endpoint);
        url.searchParams.set("client_id", CLIENT_ID!);
        url.searchParams.set(
          "post_logout_redirect_uri",
          new URL("/", publicBase(req)).toString(),
        );
        location = url.toString();
      }
    } catch {
      // fall back to local logout
    }
  }
  headers.append("location", location);
  return new Response(null, { status: 302, headers });
}
