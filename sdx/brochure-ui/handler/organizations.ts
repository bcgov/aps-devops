import React from "react";
import { countBy, loadOrganizations, loadSubsystems } from "../data.ts";
import { config } from "../lib/config.ts";
import { OrganizationsPage } from "../pages/OrganizationsPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export async function handleOrganizations(
  user: SessionUser | null,
): Promise<Response> {
  const [organizations, subsystems] = await Promise.all([
    loadOrganizations(),
    loadSubsystems(),
  ]);
  const subsystemCounts = countBy(
    subsystems,
    (subsystem) => subsystem.organization.name,
  );
  return htmlResponse(
    React.createElement(OrganizationsPage, {
      organizations,
      subsystemCounts,
      config,
      currentPath: "/organizations",
      user,
    }),
  );
}
