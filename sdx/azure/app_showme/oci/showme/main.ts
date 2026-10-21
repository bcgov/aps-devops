// ---------------------------------------------------------------------------
// Server entry point
// ---------------------------------------------------------------------------

import { decodeBase64Url } from "jsr:@std/encoding/base64url";

const PORT = 8000;

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const decoded = decodeBase64Url(parts[1]);
    return JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    return null;
  }
}

function handleRequest(req: Request): Response {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/v1/me") {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return Response.json({ user: "anonymous" });
    }

    const spaceIdx = authHeader.indexOf(" ");
    const scheme = spaceIdx !== -1 ? authHeader.slice(0, spaceIdx).toLowerCase() : "";
    const token = spaceIdx !== -1 ? authHeader.slice(spaceIdx + 1).trim() : "";

    if (scheme !== "bearer" || !token) {
      return Response.json({ error: "Invalid Authorization header" }, { status: 400 });
    }

    const claims = parseJwtClaims(token);
    if (!claims) {
      return Response.json({ error: "Invalid JWT" }, { status: 400 });
    }

    return Response.json(claims);
  }

  return new Response("Not Found", { status: 404 });
}

console.log(`Listening: http://localhost:${PORT}`);
console.log(`
Endpoints:
  GET /v1/me         Returns JWT claims from Authorization header, or {user:"anonymous"} if unauthenticated

`);

Deno.serve({ port: PORT }, handleRequest);
