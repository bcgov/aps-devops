interface LogStreamOptions {
  authConfigured: boolean;
  signedIn: boolean;
  upstreamUrl: string;
  transform: () => TransformStream<Uint8Array, Uint8Array>;
  fetcher?: typeof fetch;
}

/** Operational logs require a session even when OIDC is misconfigured. */
export async function handleLogStream(
  req: Request,
  options: LogStreamOptions,
): Promise<Response> {
  const headers = { "content-type": "text/plain", "cache-control": "no-store" };
  if (!options.authConfigured) {
    return new Response("auth not configured", { status: 503, headers });
  }
  if (!options.signedIn) {
    // EventSource must receive an HTTP error, rather than follow a login redirect.
    return new Response("authentication required", { status: 401, headers });
  }
  try {
    const upstream = await (options.fetcher ?? fetch)(options.upstreamUrl, {
      signal: req.signal,
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      return new Response("log stream unavailable", { status: 502, headers });
    }
    return new Response(upstream.body.pipeThrough(options.transform()), {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store, no-transform",
      },
    });
  } catch {
    return new Response("log stream unavailable", { status: 502, headers });
  }
}
