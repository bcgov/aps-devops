import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogUnavailableError } from "../data.ts";
import { authEnabled } from "../lib/auth.ts";
import { loginReturnTo } from "../lib/auth-redirect.ts";
import type { SessionUser } from "../lib/auth.ts";

export function htmlResponse(
  element: React.ReactElement,
): Response {
  const markup = renderToStaticMarkup(element);
  return new Response(`<!DOCTYPE html>${markup}`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export function requireAuth(
  req: Request,
  user: SessionUser | null,
): Response | null {
  if (!authEnabled) {
    return new Response("auth not configured", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
  if (!user) {
    const returnTo = encodeURIComponent(
      loginReturnTo(req),
    );
    return new Response(null, {
      status: req.method === "GET" || req.method === "HEAD" ? 302 : 303,
      headers: {
        location: `/auth/login?returnTo=${returnTo}`,
      },
    });
  }
  return null;
}

export function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location },
  });
}

export function handleRequestError(error: unknown): Response {
  console.error(error);
  return error instanceof CatalogUnavailableError
    ? new Response("Catalogue temporarily unavailable", { status: 503 })
    : new Response("Internal Server Error", { status: 500 });
}
