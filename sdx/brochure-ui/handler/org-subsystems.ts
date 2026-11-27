import React from "react";
import { loadOrganizations, loadSubsystems } from "../data.ts";
import { config } from "../lib/config.ts";
import { OrgSubsystemsPage } from "../pages/OrgSubsystemsPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, requireAuth } from "./http.ts";

export async function handleOrgSubsystems(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  const [organizations, subsystems] = await Promise.all([
    loadOrganizations(),
    loadSubsystems(),
  ]);
  const selectedOrg = organizations.find((o) => o.name === orgName) ?? null;
  const orgSubsystems = selectedOrg
    ? subsystems.filter(
      (subsystem) => subsystem.organization.name === selectedOrg.name,
    )
    : [];

  return htmlResponse(
    React.createElement(OrgSubsystemsPage, {
      organizations,
      selectedOrg,
      subsystems: orgSubsystems,
      error: null,
      config,
      currentPath: "/org-subsystems",
      user: user!,
    }),
  );
}
