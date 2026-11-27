import React from "react";
import { AboutPage } from "../pages/AboutPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export function handleAbout(user: SessionUser | null): Response {
  return htmlResponse(
    React.createElement(AboutPage, {
      currentPath: "/about",
      user,
    }),
  );
}
