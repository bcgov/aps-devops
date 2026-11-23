// Where to send the browser when a request needs a (fresh) login, and what to
// do with requests that hit POST-only action endpoints with another method.

const ORIGIN_PROBE = "http://return-to.invalid";

export const CONNECTION_ACTION_PATHS: ReadonlySet<string> = new Set([
  "/connections/edit",
  "/connections/approve",
  "/connections/reject",
  "/connections/lifecycle",
  "/connections/revoke",
  "/connections/delete",
]);

export const SESSION_EXPIRED_MESSAGE =
  "Your session expired before the change was saved. Please make the change again.";

// A same-origin path (with query) that is safe to use as a redirect target,
// or the fallback. Rejects absolute and protocol-relative URLs, including
// forms such as "/\evil.example" or "/\t/evil.example" that browsers resolve
// to another host.
export function safeReturnTo(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw, ORIGIN_PROBE);
  } catch {
    return fallback;
  }
  if (parsed.origin !== ORIGIN_PROBE) return fallback;
  return parsed.pathname + parsed.search;
}

// The returnTo for a login started by this request.
export function loginReturnTo(req: Request): string {
  const url = new URL(req.url);
  if (req.method === "GET" || req.method === "HEAD") {
    return safeReturnTo(url.pathname + url.search);
  }

  const isConnectionAction = CONNECTION_ACTION_PATHS.has(url.pathname);
  const fallback = isConnectionAction
    ? url.searchParams.get("returnPath") === "/console/common-sso"
      ? "/console/common-sso"
      : "/connections"
    : "/";
  let back = fallback;
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const r = new URL(referer);
      back = safeReturnTo(r.pathname + r.search, fallback);
    } catch {
      // unparseable Referer: use the fallback
    }
  }

  const target = new URL(back, ORIGIN_PROBE);
  if (CONNECTION_ACTION_PATHS.has(target.pathname)) {
    target.pathname = "/connections";
  }
  if (
    isConnectionAction &&
    (target.pathname === "/connections" || target.pathname === "/console/common-sso")
  ) {
    target.searchParams.set("flash", "error");
    target.searchParams.set("msg", SESSION_EXPIRED_MESSAGE);
  }
  return target.pathname + target.search;
}

// Connection actions only accept POST. Anything else (for example a login
// round trip that lands on the action URL, or a bookmarked action URL) goes
// back to the connections page instead of a 405.
export function redirectStrayConnectionAction(req: Request): Response | null {
  const url = new URL(req.url);
  if (req.method === "POST" || !CONNECTION_ACTION_PATHS.has(url.pathname)) {
    return null;
  }
  return new Response(null, {
    status: 303,
    headers: { location: "/connections" + url.search },
  });
}
