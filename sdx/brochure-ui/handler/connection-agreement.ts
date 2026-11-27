import { ConnectionAgreement } from "../components/ConnectionAgreement.tsx";
import {
  connectionPrivacyZonesUrl,
  loadPrivacyZoneNames,
} from "../lib/environments.ts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createSubsystemDetailLoader,
  loadScopes,
  loadServices,
  loadSubsystems,
} from "../data.ts";
import { listConnections, SdxApiError } from "../lib/connections.ts";
import type { SessionUser } from "../lib/auth.ts";

export async function handleConnectionAgreement(
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const headers = {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
  };
  if (!user?.accessToken) {
    return new Response("Sign in to view this agreement.", {
      status: 401,
      headers,
    });
  }

  const org = url.searchParams.get("org");
  const clientId = url.searchParams.get("clientId");
  const serviceId = url.searchParams.get("serviceId");
  const id = url.searchParams.get("id");
  if (!org || !clientId || !serviceId) {
    return new Response("Missing connection identifiers.", {
      status: 400,
      headers,
    });
  }

  try {
    const connections = await listConnections(org, {
      accessToken: user.accessToken,
      signal: AbortSignal.timeout(10_000),
    });
    const connection = connections.find((conn) =>
      conn.clientId === clientId && conn.serviceId === serviceId &&
      (!id || conn.id === id)
    );
    if (!connection) {
      return new Response("Connection request unavailable.", {
        status: 404,
        headers,
      });
    }

    const [services, subsystems, resourceScopes] = await Promise.all([
      loadServices(),
      loadSubsystems(),
      loadScopes(),
    ]);
    const service = services.find((item) =>
      item.name === serviceId && item.environment === connection.environment
    ) ?? services.find((item) =>
      item.name === serviceId
    );
    const providerId = service?.subsystem.clientId ??
      connection.serviceResources?.subsystemId;
    const loadParty = createSubsystemDetailLoader(subsystems);

    const zonesUrl = connectionPrivacyZonesUrl(
      serviceId,
      connection.environment ?? service?.environment,
    );
    const [client, provider, privacyZoneNames] = await Promise.all([
      loadParty(clientId),
      loadParty(providerId),
      connection.requesterDetails?.client?.privacyZone ||
        connection.requesterDetails?.service?.privacyZone
        ? loadPrivacyZoneNames(zonesUrl)
        : undefined,
    ]);

    const html = renderToStaticMarkup(React.createElement(ConnectionAgreement, {
      id: "connection-agreement",
      org,
      connection,
      catalog: {
        client,
        provider,
        service,
        privacyZoneNames,
        scopes: new Map(resourceScopes.map((scope) => [scope.name, scope])),
      },
    }));
    return new Response(html, {
      headers: { ...headers, "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const status =
      error instanceof SdxApiError && [401, 403, 404].includes(error.status)
        ? error.status
        : 502;
    return new Response("Could not load this agreement.", { status, headers });
  }
}
