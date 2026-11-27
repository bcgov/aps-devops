import React from "react";
import { countBy, loadServices, loadSubsystems } from "../data.ts";
import { config } from "../lib/config.ts";
import { SubsystemsPage } from "../pages/SubsystemsPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export async function handleSubsystems(
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const [subsystems, services] = await Promise.all([
    loadSubsystems(),
    loadServices(),
  ]);
  const query = url.searchParams.get("q") ?? "";
  const filtered = query.trim()
    ? subsystems.filter(
      (s) =>
        s.name
          .toLowerCase()
          .includes(query.toLowerCase()) ||
        s.organization.title
          .toLowerCase()
          .includes(query.toLowerCase()) ||
        (s.description ?? "")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    : subsystems;
  const serviceCounts = countBy(
    services,
    (service) => service.subsystem.clientId,
  );
  return htmlResponse(
    React.createElement(SubsystemsPage, {
      subsystems: filtered,
      serviceCounts,
      query,
      config,
      currentPath: "/subsystems",
      user,
    }),
  );
}
