import React from "react";
import { loadOrganizations, loadServices, loadSubsystems } from "../data.ts";
import { config } from "../lib/config.ts";
import { HomePage } from "../pages/HomePage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export async function handleHome(user: SessionUser | null): Promise<Response> {
  const [subsystems, organizations, services] = await Promise.all([
    loadSubsystems(),
    loadOrganizations(),
    loadServices(),
  ]);
  return htmlResponse(
    React.createElement(HomePage, {
      subsystems,
      organizations,
      services,
      config,
      currentPath: "/",
      user,
    }),
  );
}
