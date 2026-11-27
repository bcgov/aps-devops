import React from "react";
import { loadScopes } from "../data.ts";
import { config } from "../lib/config.ts";
import type { ResourceScope } from "../types.ts";
import { ScopesPage } from "../pages/ScopesPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, requireAuth } from "./http.ts";

export async function handleScopes(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  let scopes: ResourceScope[] = [];
  let scopesError: string | null = null;
  try {
    scopes = await loadScopes();
  } catch (e) {
    scopesError = `Failed to load resource scopes: ${(e as Error).message}`;
  }
  return htmlResponse(
    React.createElement(ScopesPage, {
      scopes,
      error: scopesError,
      config,
      currentPath: "/scopes",
      user: user!,
    }),
  );
}
