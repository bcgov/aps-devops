import React from "react";
import {
  loadConnectionOrganizations,
  loadServices,
  loadSubsystems,
} from "../data.ts";
import { config } from "../lib/config.ts";
import type { ActivityRecord } from "../types.ts";
import { CommonSsoPage } from "../pages/CommonSsoPage.tsx";
import { ConnectionsPage } from "../pages/ConnectionsPage.tsx";
import { connectionTraffic } from "../lib/metrics.ts";
import {
  listConnections,
  listSubmissionActivity,
  SdxApiError,
} from "../lib/connections.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, redirect, requireAuth } from "./http.ts";

export async function handleConnections(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  if (
    url.pathname === "/connections" &&
    url.searchParams.get("role") === "services"
  ) {
    url.searchParams.delete("role");
    return redirect(`/console/common-sso${url.search}`);
  }
  const flashKind = url.searchParams.get("flash");
  const flashMsg = url.searchParams.get("msg");
  const flash = flashKind === "success" || flashKind === "error"
    ? { kind: flashKind, message: flashMsg ?? "" }
    : null;

  const [organizations, subsystems, services] = await Promise.all([
    loadConnectionOrganizations(orgName),
    loadSubsystems(),
    loadServices(),
  ]);
  const integrationOrganizations = new Set(
    subsystems.filter((subsystem) => subsystem.integrationClientIds?.length)
      .map((subsystem) => subsystem.organization.name),
  );
  const availableOrganizations = url.pathname === "/console/common-sso"
    ? organizations.filter((org) => integrationOrganizations.has(org.name))
    : organizations;
  const selectedOrg =
    availableOrganizations.find((org) => org.name === orgName) ?? null;

  let connections: Awaited<
    ReturnType<typeof listConnections>
  > = [];
  let error: string | null = null;
  if (selectedOrg) {
    try {
      connections = await listConnections(
        selectedOrg.name,
        {
          accessToken: user!.accessToken,
        },
      );
    } catch (e) {
      error = e instanceof SdxApiError
        ? `Failed to load connections (${e.status}): ${e.body}`
        : (e as Error).message;
    }
  }

  const connectionList = React.createElement(ConnectionsPage, {
    organizations: availableOrganizations,
    selectedOrg,
    connections,
    allSubsystems: subsystems,
    services,
    config,
    openClients: url.searchParams.getAll("openClient"),
    currentPath: url.pathname,
    user: user!,
    flash,
    error,
  });

  if (url.pathname === "/connections") return htmlResponse(connectionList);

  let activity: ActivityRecord[] = [];
  let submissionsError: string | undefined;
  if (!user!.accessToken) {
    submissionsError = "Sign in again to load your submissions.";
  } else {
    try {
      activity = await listSubmissionActivity(user!.accessToken);
    } catch (cause) {
      submissionsError = cause instanceof SdxApiError && cause.status === 401
        ? "Sign in again to load your submissions."
        : "Your submissions could not be loaded.";
    }
  }
  const response = htmlResponse(React.createElement(CommonSsoPage, {
    currentPath: url.pathname,
    user: user!,
    activity,
    error: submissionsError,
    children: connectionList,
  }));
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function handleConnectionProvisioning(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  if (!user?.accessToken) return Response.json(null, { status: 401, headers });
  const org = url.searchParams.get("org");
  if (!org) return Response.json(null, { status: 400, headers });
  try {
    const connections = await listConnections(org, {
      accessToken: user.accessToken,
      signal: req.signal,
    });
    const busy = connections.filter(({ provisionerStatus }) =>
      provisionerStatus?.status === "pending" ||
      provisionerStatus?.status === "deprovisioning"
    ).map(({ id, clientId, serviceId }) => [id ?? "", clientId, serviceId]);
    return Response.json({ busy }, { headers });
  } catch {
    return Response.json(null, { status: 502, headers });
  }
}

export async function handleConnectionTraffic(
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  if (!user?.accessToken) {
    return Response.json({ error: "Sign in to view connection traffic." }, {
      status: 401,
      headers,
    });
  }
  const org = url.searchParams.get("org");
  const clientId = url.searchParams.get("clientId");
  const serviceId = url.searchParams.get("serviceId");
  if (!org || !clientId || !serviceId) {
    return Response.json({ error: "Missing connection identifiers." }, {
      status: 400,
      headers,
    });
  }
  try {
    const connections = await listConnections(org, {
      accessToken: user.accessToken,
    });
    if (
      !connections.some((conn) =>
        conn.isApproved && conn.clientId === clientId &&
        conn.serviceId === serviceId
      )
    ) {
      return Response.json({
        error: "Traffic is available for approved connections.",
      }, { status: 404, headers });
    }
    return Response.json(await connectionTraffic(), { headers });
  } catch (error) {
    const status =
      error instanceof SdxApiError && [401, 403, 404].includes(error.status)
        ? error.status
        : 502;
    return Response.json({ error: "Connection traffic is unavailable." }, {
      status,
      headers,
    });
  }
}
