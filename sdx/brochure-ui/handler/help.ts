import React from "react";
import { HelpPage } from "../pages/HelpPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export function handleHelp(user: SessionUser | null): Response {
  return htmlResponse(
    React.createElement(HelpPage, {
      currentPath: "/help",
      user,
    }),
  );
}
