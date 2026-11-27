import React from "react";
import {
  attachOperationTags,
  fetchSubsystemDetail,
  getSubsystemKeysets,
  loadServices,
  loadSubsystems,
} from "../data.ts";
import { config } from "../lib/config.ts";
import type { Subsystem } from "../types.ts";
import { SubsystemDetailPage } from "../pages/SubsystemDetailPage.tsx";
import { getClientDetail, SdxApiError } from "../lib/connections.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, notFound, requireAuth } from "./http.ts";

export async function handleSubsystemDetail(
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const path = url.pathname;
  const clientId = decodeURIComponent(
    path.slice("/subsystems/".length),
  );
  const [subsystems, services] = await Promise.all([
    loadSubsystems(),
    loadServices(),
  ]);
  const subsystem = subsystems.find(
    (s) => s.clientId === clientId,
  );
  if (!subsystem) return notFound();
  // The list endpoint omits `access`; the per-subsystem detail response
  // carries the users and roles that have access to this subsystem.
  const subsystemServices = structuredClone(services.filter(
    (service) => service.subsystem.clientId === clientId,
  ));
  const [detail, subsystemKeys] = await Promise.all([
    fetchSubsystemDetail(clientId),
    getSubsystemKeysets(clientId),
    attachOperationTags(subsystemServices),
  ]);
  const subsystemDetail: Subsystem = detail
    ? { ...subsystem, ...detail }
    : subsystem;
  return htmlResponse(
    React.createElement(SubsystemDetailPage, {
      subsystem: subsystemDetail,
      services: subsystemServices,
      subsystemKeys,
      config,
      currentPath: path,
      user,
    }),
  );
}

export async function handleSubsystemApi(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const path = url.pathname;
  const gate = requireAuth(req, user);
  if (gate) return gate;
  const clientId = decodeURIComponent(
    path.slice("/api/subsystems/".length),
  );
  const subsystems = await loadSubsystems();
  const subsystem = subsystems.find(
    (s) => s.clientId === clientId,
  );
  if (!subsystem) {
    console.error(
      `/api/subsystems/${clientId}: not found in catalogue (${subsystems.length} subsystems loaded)`,
    );
    return new Response(
      `subsystem not found: ${clientId}`,
      {
        status: 404,
        headers: { "content-type": "text/plain" },
      },
    );
  }
  // Org-scoped client endpoint — unlike the public catalog's subsystem
  // detail, this includes runtime group info. Takes the plain subsystem
  // name (subsystem.name), not the dotted subsystem.clientId used to look
  // it up in the cached catalog above.
  try {
    const detail = await getClientDetail(
      subsystem.organization.name,
      subsystem.name,
      { accessToken: user!.accessToken },
    );
    return Response.json(
      { ...subsystem, ...detail },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    const status = e instanceof SdxApiError ? e.status : 502;
    return new Response((e as Error).message, {
      status,
      headers: { "content-type": "text/plain" },
    });
  }
}
