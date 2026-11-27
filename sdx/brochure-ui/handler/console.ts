import React from "react";
import { config } from "../lib/config.ts";
import { ConsolePage } from "../pages/ConsolePage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, requireAuth } from "./http.ts";

export function handleConsole(
  req: Request,
  user: SessionUser | null,
): Response {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  return htmlResponse(
    React.createElement(ConsolePage, {
      config,
      currentPath: "/console",
      user: user!,
    }),
  );
}
