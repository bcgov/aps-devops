import { ConnectionAgreement } from "./components/ConnectionAgreement.tsx";
import { verifyOrganizationResponse } from "./lib/response-verification.ts";
import { certificatePayload, certificatesWithoutRuntime, fetchSigningKeyset, planCertificateInstall } from "./lib/org-signing-keyset.ts";
import { registerOrgCertificate, requestOrgCsr } from "./lib/org-signing.ts";
import { connectionPrivacyZonesUrl, loadPrivacyZoneNames, orgKeysetsUrlForEnv } from "./lib/environments.ts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ACTIVITY_PAGE_SIZE,
  CatalogUnavailableError,
  ORGANIZATION_ACTIVITY_PAGE_SIZE,
  attachOperationTags,
  countBy,
  createSubsystemDetailLoader,
  fetchSubsystemDetail,
  getJwks,
  getOrgKeysets,
  getSubsystemKeysets,
  loadActivity,
  loadOrganizationDetail,
  loadOrganizations,
  loadScopes,
  loadServices,
  loadSubsystems,
  openLogStream,
  readPublicAsset,
} from "./data.ts";
import { config } from "./lib/config.ts";
import type {
  ActivityRecord,
  ResourceScope,
  Subsystem,
} from "./types.ts";
import { HomePage } from "./pages/HomePage.tsx";
import { AboutPage } from "./pages/AboutPage.tsx";
import { HelpPage } from "./pages/HelpPage.tsx";
import { SubsystemsPage } from "./pages/SubsystemsPage.tsx";
import { OrganizationsPage } from "./pages/OrganizationsPage.tsx";
import { OrgDetailPage } from "./pages/OrgDetailPage.tsx";
import { SubsystemDetailPage } from "./pages/SubsystemDetailPage.tsx";
import { ActivityConsolePage } from "./pages/ActivityConsolePage.tsx";
import { LogsPage } from "./pages/LogsPage.tsx";
import { MetricsPage } from "./pages/MetricsPage.tsx";
import { CommonSsoPage } from "./pages/CommonSsoPage.tsx";
import { ConsolePage } from "./pages/ConsolePage.tsx";
import { ScopesPage } from "./pages/ScopesPage.tsx";
import { RuntimesPage } from "./pages/RuntimesPage.tsx";
import { OrgSubsystemsPage } from "./pages/OrgSubsystemsPage.tsx";
import { TrafficPage } from "./pages/TrafficPage.tsx";
import { TrustPage } from "./pages/TrustPage.tsx";
import { ConnectionsPage } from "./pages/ConnectionsPage.tsx";
import { OnboardingInvitePage } from "./pages/OnboardingInvitePage.tsx";
import { VerificationBadge } from "./components/custom/VerificationBadge.tsx";
import {
  connectionTraffic,
  MetricsQueryNotFoundError,
  runQuery,
} from "./lib/metrics.ts";
import { verifyActivityEvent } from "./lib/verification.ts";
import {
  authEnabled,
  completeLogin,
  getCurrentUser,
  hasSameRequestOrigin,
  logout,
  startLogin,
} from "./lib/auth.ts";
import {
  loginReturnTo,
  redirectStrayConnectionAction,
  safeReturnTo,
} from "./lib/auth-redirect.ts";
import {
  deleteConnection,
  getClientDetail,
  listConnections,
  listOrgActivity,
  listSubmissionActivity,
  runConnectionLifecycle,
  SdxApiError,
  setConnectionApproval,
  upsertConnection,
} from "./lib/connections.ts";
import { listRuntimeGroups } from "./lib/runtime-groups.ts";
import {
  getPublicBody,
  getPublicBodyTypes,
  resolvePublicBodyType,
  type PublicBody,
  type PublicBodyType,
} from "./lib/public-bodies.ts";
import { ensureFonts } from "./lib/fonts.ts";
import { DEFAULT_ENV } from "./lib/environments.ts";

await ensureFonts();

function htmlResponse(
  element: React.ReactElement,
): Response {
  const markup = renderToStaticMarkup(element);
  return new Response(`<!DOCTYPE html>${markup}`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
};

function makeVerifyingTransform(): TransformStream<
  Uint8Array,
  Uint8Array
> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  async function transformBlock(
    block: string,
  ): Promise<string> {
    const lines = block.split(/\r?\n/);
    const dataIdx = lines.findIndex((l) =>
      l.startsWith("data:"),
    );
    if (dataIdx === -1) return block;
    const payload = lines[dataIdx]
      .slice("data:".length)
      .trimStart();
    // deno-lint-ignore no-explicit-any
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      return block;
    }
    if (!event || typeof event !== "object" || !event.value)
      return block;
    try {
      const verification = await verifyActivityEvent(
        event.value,
      );
      if (verification) {
        event.verification = verification;
        event.verificationHtml = renderToStaticMarkup(
          React.createElement(VerificationBadge, {
            verification,
          }),
        );
      }
    } catch (e) {
      const msg = (e as Error).message;
      const err = {
        status: "error" as const,
        message: msg,
      };
      event.verification = {
        edgeToken: { request: err, response: err },
        entitySig: { request: err, response: err },
      };
    }
    lines[dataIdx] = `data: ${JSON.stringify(event)}`;
    return lines.join("\n");
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const sep = /\r?\n\r?\n/;
      let match: RegExpExecArray | null;
      while ((match = sep.exec(buffer)) !== null) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(
          match.index + match[0].length,
        );
        const transformed = await transformBlock(block);
        controller.enqueue(
          encoder.encode(transformed + "\n\n"),
        );
      }
    },
    flush(controller) {
      if (buffer.length > 0)
        controller.enqueue(encoder.encode(buffer));
    },
  });
}

async function servePublic(
  pathname: string,
): Promise<Response> {
  const rel = pathname.slice("/public/".length);
  if (!rel || rel.includes("..") || rel.startsWith("/"))
    return notFound();
  try {
    const file = await readPublicAsset(rel);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      MIME_TYPES[ext] ?? "application/octet-stream";
    return new Response(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return notFound();
  }
}

const PORT = Number(Deno.env.get("PORT") ?? "5500");

function handleRequestError(error: unknown): Response {
  console.error(error);
  return error instanceof CatalogUnavailableError
    ? new Response("Catalogue temporarily unavailable", { status: 503 })
    : new Response("Internal Server Error", { status: 500 });
}

Deno.serve({ port: PORT, onError: handleRequestError }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.startsWith("/public/")) {
    return servePublic(path);
  }

  if (path === "/auth/login") {
    if (!authEnabled)
      return new Response("auth not configured", {
        status: 503,
      });
    const returnTo = safeReturnTo(
      url.searchParams.get("returnTo"),
    );
    return await startLogin(req, returnTo);
  }
  if (path === "/auth/callback") {
    if (!authEnabled)
      return new Response("auth not configured", {
        status: 503,
      });
    return await completeLogin(req);
  }
  if (path === "/auth/logout") {
    return await logout(req);
  }

  if (path === "/api/trust/verify-response") {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!hasSameRequestOrigin(req)) return new Response("Invalid origin", { status: 403 });
    try {
      const form = await req.formData();
      const organizations = await loadOrganizations();
      const org = organizations.find((entry) => entry.name === String(form.get("org")));
      const environment = String(form.get("environment") ?? "");
      const env = config.environments?.find((entry) => entry.id === environment);
      if (!org || !env) throw new Error("Select an organization and configured environment");
      const field = (name: string) => String(form.get(name) ?? "").trim();
      const result = await verifyOrganizationResponse({
        environment, memberClass:org.member.memberClass, memberId:org.member.memberId,
        edgeToken:field("edgeToken"), entitySig:field("entitySig"),
      }, { jwksUrls:env.jwks_urls ?? [], registryBase:env.org_keysets_url });
      return Response.json(result, {headers:{"cache-control":"no-store"}});
    } catch (error) {
      return Response.json({verified:false,checks:[{label:"Verification",passed:false,message:(error as Error).message}]}, {headers:{"cache-control":"no-store"}});
    }
  }

  const user = await getCurrentUser(req);

  if (path === "/onboarding/invite") {
    const integrationId =
      url.searchParams.get("integrationId")?.trim() ?? "";
    return htmlResponse(
      React.createElement(OnboardingInvitePage, {
        integrationId,
        currentPath: `${path}${url.search}`,
        user,
      }),
    );
  }

  if (path === "/") {
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

  if (path === "/about") {
    return htmlResponse(
      React.createElement(AboutPage, {
        currentPath: "/about",
        user,
      }),
    );
  }

  if (path === "/help") {
    return htmlResponse(
      React.createElement(HelpPage, {
        currentPath: "/help",
        user,
      }),
    );
  }

  if (path === "/subsystems") {
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

  if (path.startsWith("/subsystems/")) {
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
    const subsystemServices = services.filter(
      (service) => service.subsystem.clientId === clientId,
    );
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

  if (path === "/organizations") {
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

  if (path === "/api/activity") {
    const first = Math.min(
      Math.max(
        Number(url.searchParams.get("first") ?? "20") || 20,
        1,
      ),
      100,
    );
    const skip = Math.max(
      Number(url.searchParams.get("skip") ?? "0") || 0,
      0,
    );
    const organization =
      url.searchParams.get("organization") ?? undefined;
    try {
      const records = await loadActivity(
        first,
        skip,
        organization,
      );
      return Response.json(records, {
        headers: { "cache-control": "no-store" },
      });
    } catch (e) {
      return new Response((e as Error).message, {
        status: 502,
        headers: { "content-type": "text/plain" },
      });
    }
  }

  if (path === "/logs") {
    if (authEnabled && !user) {
      const returnTo = encodeURIComponent(
        path + url.search,
      );
      return new Response(null, {
        status: 302,
        headers: {
          location: `/auth/login?returnTo=${returnTo}`,
        },
      });
    }
    return htmlResponse(
      React.createElement(LogsPage, {
        logStreamUrl: "/log-stream",
        config,
        currentPath: "/logs",
        user,
      }),
    );
  }

  if (path === "/metrics") {
    if (authEnabled && !user) {
      const returnTo = encodeURIComponent(
        path + url.search,
      );
      return new Response(null, {
        status: 302,
        headers: {
          location: `/auth/login?returnTo=${returnTo}`,
        },
      });
    }
    try {
      const konglogData = await runQuery(
        "konglog_service_code",
        "24h",
      );
      return htmlResponse(
        React.createElement(MetricsPage, {
          konglogData,
          config,
          currentPath: "/metrics",
          user,
        }),
      );
    } catch (e) {
      return new Response(
        `Metrics service unavailable: ${(e as Error).message}`,
        {
          status: 502,
          headers: { "content-type": "text/plain" },
        },
      );
    }
  }

  if (path === "/traffic") {
    const [subsystems, services] = await Promise.all([
      loadSubsystems(),
      loadServices(),
    ]);
    return htmlResponse(
      React.createElement(TrafficPage, {
        subsystems,
        services,
        logStreamUrl: "/log-stream",
        config,
        currentPath: "/traffic",
        user,
      }),
    );
  }

  if (path === "/console") {
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

  if (path === "/runtimes/signing") {
    return await handleRuntimes(req, url, user);
  }

  if (path === "/runtimes") {
    return await handleRuntimes(req, url, user);
  }

  if (path === "/org-subsystems") {
    return await handleOrgSubsystems(req, url, user);
  }

  if (path.startsWith("/api/subsystems/")) {
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
      const status =
        e instanceof SdxApiError ? e.status : 502;
      return new Response((e as Error).message, {
        status,
        headers: { "content-type": "text/plain" },
      });
    }
  }

  if (path === "/scopes") {
    const gate = requireAuth(req, user);
    if (gate) return gate;
    let scopes: ResourceScope[] = [];
    let scopesError: string | null = null;
    try {
      scopes = await loadScopes();
    } catch (e) {
      scopesError = `Failed to load resource scopes: ${(e as Error).message}`;
    }
    return htmlResponse(
      React.createElement(ScopesPage, {
        scopes,
        error: scopesError,
        config,
        currentPath: "/scopes",
        user: user!,
      }),
    );
  }

  if (path === "/org-activity") {
    return await handleOrgActivity(req, url, user);
  }

  if (path === "/api/org-activity") {
    return await handleOrgActivityApi(req, url, user);
  }

  if (path === "/log-stream") {
    try {
      const upstream = await openLogStream(req.signal);
      if (!upstream.ok || !upstream.body) {
        return new Response(
          `upstream HTTP ${upstream.status}`,
          {
            status: 502,
            headers: { "content-type": "text/plain" },
          },
        );
      }
      const body = upstream.body.pipeThrough(
        makeVerifyingTransform(),
      );
      return new Response(body, {
        headers: {
          "content-type":
            upstream.headers.get("content-type") ??
            "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    } catch (e) {
      return new Response((e as Error).message, {
        status: 502,
        headers: { "content-type": "text/plain" },
      });
    }
  }

  if (path === "/trust") {
    const allSources = await getJwks();
    // The environment switcher only renders for logged-in users. Anonymous
    // visitors can't switch, so show only the default environment's sources
    // (plus any that are environment-agnostic).
    const sources = user
      ? allSources
      : allSources.filter(
        (s) => !s.environment || s.environment === DEFAULT_ENV,
      );
    return htmlResponse(
      React.createElement(TrustPage, {
        sources,
        config,
        currentPath: "/trust",
        user,
      }),
    );
  }

  if (path === "/api/activity/konglog") {
    try {
      const data = await runQuery(
        "konglog_service_code",
        "24h",
      );
      return Response.json(data, {
        headers: { "cache-control": "no-store" },
      });
    } catch (e) {
      const status =
        e instanceof MetricsQueryNotFoundError ? 404 : 502;
      return new Response((e as Error).message, {
        status,
        headers: { "content-type": "text/plain" },
      });
    }
  }

  if (path.startsWith("/organizations/")) {
    const orgName = decodeURIComponent(
      path.slice("/organizations/".length),
    );
    const [organizations, subsystems, services] = await Promise.all([
      loadOrganizations(),
      loadSubsystems(),
      loadServices(),
    ]);
    const org = organizations.find(
      (o) => o.name === orgName,
    );
    if (!org) return notFound();
    const orgDetail = await loadOrganizationDetail(org);
    const orgSubsystems = subsystems.filter(
      (subsystem) => subsystem.organization.name === orgName,
    );
    const serviceCounts = countBy(
      services,
      (service) => service.subsystem.clientId,
    );

    let publicBody: PublicBody | null = null;
    let publicBodyType: PublicBodyType | null = null;
    let publicBodyError: string | null = null;
    if (org.publicBodyId) {
      try {
        const [body, types] = await Promise.all([
          getPublicBody(org.publicBodyId),
          getPublicBodyTypes(),
        ]);
        publicBody = body;
        publicBodyType = resolvePublicBodyType(
          types,
          body?.typeId,
        );
      } catch (e) {
        publicBodyError = `Public body lookup failed: ${(e as Error).message}`;
      }
    }

    let activity: ActivityRecord[] = [];
    let activityError: string | null = null;
    try {
      activity = await loadActivity(
        ORGANIZATION_ACTIVITY_PAGE_SIZE,
        0,
        org.name,
      );
    } catch (e) {
      activityError = `Activity feed unavailable: ${(e as Error).message}`;
    }

    const orgKeys = await getOrgKeysets(
      org.member.memberClass,
      org.member.memberId,
    );

    return htmlResponse(
      React.createElement(OrgDetailPage, {
        org: orgDetail,
        subsystems: orgSubsystems,
        serviceCounts,
        publicBody,
        publicBodyType,
        publicBodyError,
        activity,
        activityPageSize: ORGANIZATION_ACTIVITY_PAGE_SIZE,
        activityError,
        orgKeys,
        config,
        currentPath: path,
        user,
      }),
    );
  }

  if (path === "/api/connections/agreement" && req.method === "GET") {
    return await handleConnectionAgreement(url, user);
  }

  if (path === "/api/connections/provisioning" && req.method === "GET") {
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

  if (path === "/api/connections/traffic" && req.method === "GET") {
    const headers = { "cache-control": "no-store" };
    if (!user?.accessToken) {
      return Response.json({ error: "Sign in to view connection traffic." }, { status: 401, headers });
    }
    const org = url.searchParams.get("org");
    const clientId = url.searchParams.get("clientId");
    const serviceId = url.searchParams.get("serviceId");
    if (!org || !clientId || !serviceId) {
      return Response.json({ error: "Missing connection identifiers." }, { status: 400, headers });
    }
    try {
      const connections = await listConnections(org, { accessToken: user.accessToken });
      if (!connections.some((conn) =>
        conn.isApproved && conn.clientId === clientId && conn.serviceId === serviceId
      )) {
        return Response.json({ error: "Traffic is available for approved connections." }, { status: 404, headers });
      }
      return Response.json(await connectionTraffic(), { headers });
    } catch (error) {
      const status = error instanceof SdxApiError && [401, 403, 404].includes(error.status)
        ? error.status
        : 502;
      return Response.json({ error: "Connection traffic is unavailable." }, { status, headers });
    }
  }

  if (path === "/connections" || path === "/console/common-sso") {
    return await handleConnections(req, url, user);
  }
  const strayAction = redirectStrayConnectionAction(req);
  if (strayAction) return strayAction;
  if (path === "/connections/edit") {
    return await handleConnectionsEdit(req, user);
  }
  if (path === "/connections/approve") {
    return await handleConnectionsApprove(req, user);
  }
  if (path === "/connections/reject") {
    return await handleConnectionsReject(req, user);
  }
  if (path === "/connections/lifecycle") {
    return await handleConnectionsLifecycle(req, user);
  }
  if (path === "/connections/revoke") {
    return await handleConnectionsRevoke(req, user);
  }
  if (path === "/connections/delete") {
    return await handleConnectionsDelete(req, user);
  }

  return notFound();
});

function requireAuth(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Response | null {
  if (!authEnabled) {
    return new Response("auth not configured", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
  if (!user) {
    const returnTo = encodeURIComponent(
      loginReturnTo(req),
    );
    return new Response(null, {
      status: req.method === "GET" || req.method === "HEAD" ? 302 : 303,
      headers: {
        location: `/auth/login?returnTo=${returnTo}`,
      },
    });
  }
  return null;
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location },
  });
}

function connectionsRedirect(
  req: Request,
  org: string,
  flash: { kind: "success" | "error"; message: string },
  subsystem?: string,
): Response {
  const params = new URLSearchParams({
    org,
    flash: flash.kind,
    msg: flash.message,
  });
  const actionUrl = new URL(req.url);
  let state = actionUrl.searchParams;
  let returnPath = state.get("returnPath");
  if (!returnPath) {
    const referrer = req.headers.get("referer");
    if (referrer && URL.canParse(referrer)) {
      const source = new URL(referrer);
      if (
        source.origin === actionUrl.origin &&
        (source.pathname === "/connections" || source.pathname === "/console/common-sso") &&
        source.searchParams.get("org") === org
      ) {
        state = source.searchParams;
        returnPath = source.pathname;
      }
    }
  }
  const destination = returnPath === "/console/common-sso" || state.get("role") === "services"
    ? "/console/common-sso"
    : "/connections";
  const openClients = new Set(state.getAll("openClient"));
  if (subsystem) openClients.add(subsystem);
  for (const clientId of openClients) {
    params.append("openClient", clientId);
  }
  if (subsystem) {
    params.set("subsystem", subsystem);
    const serviceId = actionUrl.searchParams.get("returnService");
    if (serviceId) params.set("returnService", serviceId);
  }
  return new Response(null, { status: 303, headers: { location: `${destination}?${params}` } });
}

async function handleRuntimes(
  req: Request,
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  if (url.pathname === "/runtimes/signing" && !user && req.headers.get("accept")?.includes("application/json")) {
    return Response.json({ error: "Your session has expired. Reload the page and sign in again." }, { status: 401 });
  }
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const isSigning = url.pathname === "/runtimes/signing";
  if (isSigning && req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (isSigning && !hasSameRequestOrigin(req)) {
    const error = "Invalid request origin. Open the Member Console directly and try again.";
    return req.headers.get("accept")?.includes("application/json")
      ? Response.json({ error }, { status: 403 })
      : new Response(error, { status: 403 });
  }
  const form = isSigning ? await req.formData() : null;
  const orgName = String(form?.get("org") ?? url.searchParams.get("org") ?? "");
  const organizations = await loadOrganizations();
  const selectedOrg = organizations.find((o) => o.name === orgName) ?? null;

  let ownedGroups: Awaited<
    ReturnType<typeof listRuntimeGroups>
  > = [];
  let availableGroups: Awaited<
    ReturnType<typeof listRuntimeGroups>
  > = [];
  let error: string | null = null;
  if (selectedOrg) {
    try {
      [ownedGroups, availableGroups] = await Promise.all([
        listRuntimeGroups(selectedOrg.name, "owned", {
          accessToken: user!.accessToken,
        }),
        listRuntimeGroups(selectedOrg.name, "available", {
          accessToken: user!.accessToken,
        }),
      ]);
    } catch (e) {
      ownedGroups = [];
      availableGroups = [];
      error = e instanceof SdxApiError
        ? `Failed to load runtime groups (${e.status}): ${e.body}`
        : (e as Error).message;
    }
  }

  const keysetUrl = (environment: string) => {
    const base = orgKeysetsUrlForEnv(environment);
    if (!base || !selectedOrg) throw new Error("Organization signing registry is not configured");
    const member = selectedOrg.member;
    const id = `sdx.org.${member.memberClass}.${member.memberId}.${environment}`.toLowerCase();
    return `${base.replace(/\/$/, "")}/${encodeURIComponent(id)}/.well-known/jwks.json`;
  };
  let signingResult: { group: string; environment: string; csr?: string; message?: string; confirmation?: string; review?: string } | undefined;
  if (isSigning) {
    try {
      const group = String(form!.get("group") ?? "");
      const environment = String(form!.get("environment") ?? "");
      if (!selectedOrg || !availableGroups.some((g) => g.name === group && g.environment === environment)) throw new Error("Select an available runtime group");
      const operation = String(form!.get("operation"));
      const opts = { accessToken: user!.accessToken };
      signingResult = { group, environment };
      if (operation === "csr") {
        signingResult.csr = await requestOrgCsr(orgName, group, environment, opts);
      } else if (operation === "review" || operation === "install" || operation === "remove") {
        const certificate = String(form!.get("certificate") ?? "").trim();
        const caCerts = config.environments?.find((env) => env.id === environment)?.signing_root_ca_pem?.trim() ?? "";
        const current = await fetchSigningKeyset(keysetUrl(environment), selectedOrg.member, environment);
        if (operation === "remove") {
          if (form!.get("confirm") !== "on") throw new Error("Confirm removal for this runtime group and environment");
          if (!current.certificates.some((entry) => entry.runtime === group.toLowerCase())) throw new Error("No certificate is registered for this runtime group");
          const retained = certificatesWithoutRuntime(current, group);
          if (retained.length && !caCerts) throw new Error(`Signing root CA is not configured for ${environment}. Contact your administrator.`);
          await registerOrgCertificate(orgName, environment, retained.length ? certificatePayload(retained, caCerts) : [], caCerts, retained.length === 0, opts);
          signingResult.message = "Organization signing removed for this runtime group and environment.";
        } else {
          if (!caCerts) throw new Error(`Signing root CA is not configured for ${environment}. Contact your administrator.`);
          const plan = planCertificateInstall(current, selectedOrg.member, environment, group, certificate, caCerts);
          if (operation === "review") {
            signingResult.confirmation = plan.confirmation;
            signingResult.review = plan.message;
          } else {
            if (form!.get("confirmed") !== "on" || form!.get("confirmation") !== plan.confirmation) throw new Error("The key set or certificate has changed. Review the installation again before confirming.");
            await registerOrgCertificate(orgName, environment, plan.certificatePem, caCerts, false, opts);
            signingResult.message = "Registration succeeded.";
          }
        }
      } else throw new Error("Unknown signing operation");
    } catch (e) { error = (e as Error).message; }
  }
  if (isSigning && req.headers.get("accept")?.includes("application/json")) {
    return Response.json(error ? { error } : signingResult, { status: error ? 400 : 200 });
  }
  const signing: Record<string, boolean | null> = {};
  if (selectedOrg) {
    await Promise.all([...new Set(availableGroups.map((g) => g.environment).filter((e): e is string => !!e))].map(async (environment) => {
      const groups = availableGroups.filter((g) => g.environment === environment);
      try {
        const current = await fetchSigningKeyset(keysetUrl(environment), selectedOrg.member, environment);
        for (const group of groups) signing[`${group.name}:${environment}`] = current.certificates.some((entry) => entry.runtime === group.name.toLowerCase());
      } catch {
        for (const group of groups) signing[`${group.name}:${environment}`] = null;
      }
    }));
  }

  return htmlResponse(
    React.createElement(RuntimesPage, {
      organizations,
      selectedOrg,
      ownedGroups,
      availableGroups,
      signing,
      signingResult,
      error,
      config,
      currentPath: "/runtimes",
      user: user!,
    }),
  );
}

async function handleOrgSubsystems(
  req: Request,
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  const [organizations, subsystems] = await Promise.all([
    loadOrganizations(),
    loadSubsystems(),
  ]);
  const selectedOrg =
    organizations.find((o) => o.name === orgName) ?? null;
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

async function handleOrgActivity(
  req: Request,
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  const organizations = await loadOrganizations();
  const selectedOrg =
    organizations.find((o) => o.name === orgName) ?? null;

  let activity: ActivityRecord[] = [];
  let error: string | null = null;
  if (selectedOrg) {
    try {
      activity = await listOrgActivity(
        selectedOrg.name,
        ACTIVITY_PAGE_SIZE,
        0,
        { accessToken: user!.accessToken },
      );
    } catch (e) {
      error =
        e instanceof SdxApiError
          ? `Failed to load activity (${e.status}): ${e.body}`
          : (e as Error).message;
    }
  }

  return htmlResponse(
    React.createElement(ActivityConsolePage, {
      organizations,
      selectedOrg,
      activity,
      pageSize: ACTIVITY_PAGE_SIZE,
      error,
      config,
      currentPath: "/org-activity",
      user: user!,
    }),
  );
}

async function handleOrgActivityApi(
  req: Request,
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "unknown";
  if (orgName === "unknown") {
    return new Response("unknown organization", {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }
  const first = Math.min(
    Math.max(
      Number(url.searchParams.get("first") ?? "20") || 20,
      1,
    ),
    100,
  );
  const skip = Math.max(
    Number(url.searchParams.get("skip") ?? "0") || 0,
    0,
  );
  try {
    const records = await listOrgActivity(
      orgName,
      first,
      skip,
      { accessToken: user!.accessToken },
    );
    return Response.json(records, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    const status =
      e instanceof SdxApiError ? e.status : 502;
    return new Response((e as Error).message, {
      status,
      headers: { "content-type": "text/plain" },
    });
  }
}

async function handleConnections(
  req: Request,
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  if (url.pathname === "/connections" && url.searchParams.get("role") === "services") {
    url.searchParams.delete("role");
    return redirect(`/console/common-sso${url.search}`);
  }
  const flashKind = url.searchParams.get("flash");
  const flashMsg = url.searchParams.get("msg");
  const flash =
    flashKind === "success" || flashKind === "error"
      ? { kind: flashKind, message: flashMsg ?? "" }
      : null;

  const [organizations, subsystems, services] = await Promise.all([
    loadOrganizations(),
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
      error =
        e instanceof SdxApiError
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

async function handleConnectionAgreement(
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const headers = { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" };
  if (!user?.accessToken) return new Response("Sign in to view this agreement.", { status: 401, headers });

  const org = url.searchParams.get("org");
  const clientId = url.searchParams.get("clientId");
  const serviceId = url.searchParams.get("serviceId");
  const id = url.searchParams.get("id");
  if (!org || !clientId || !serviceId) {
    return new Response("Missing connection identifiers.", { status: 400, headers });
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
    if (!connection) return new Response("Connection request unavailable.", { status: 404, headers });

    const [services, subsystems, resourceScopes] = await Promise.all([
      loadServices(),
      loadSubsystems(),
      loadScopes(),
    ]);
    const service = services.find((item) =>
      item.name === serviceId && item.environment === connection.environment
    ) ?? services.find((item) => item.name === serviceId);
    const providerId = service?.subsystem.clientId ?? connection.serviceResources?.subsystemId;
    const loadParty = createSubsystemDetailLoader(subsystems);

    const zonesUrl = connectionPrivacyZonesUrl(serviceId, connection.environment ?? service?.environment);
    const [client, provider, privacyZoneNames] = await Promise.all([
      loadParty(clientId),
      loadParty(providerId),
      connection.requesterDetails?.client?.privacyZone || connection.requesterDetails?.service?.privacyZone
        ? loadPrivacyZoneNames(zonesUrl)
        : undefined,
    ]);

    const html = renderToStaticMarkup(React.createElement(ConnectionAgreement, {
      id: "connection-agreement",
      org,
      connection,
      catalog: { client, provider, service, privacyZoneNames,
        scopes: new Map(resourceScopes.map((scope) => [scope.name, scope])) },
    }));
    return new Response(html, {
      headers: { ...headers, "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const status = error instanceof SdxApiError && [401, 403, 404].includes(error.status)
      ? error.status
      : 502;
    return new Response("Could not load this agreement.", { status, headers });
  }
}

async function handleConnectionsEdit(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
    });
  }

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const raw = String(form.get("payload") ?? "{}");

  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }

  let payload: {
    clientResources?: Record<string, unknown>;
    serviceResources?: Record<string, unknown>;
  };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object")
      throw new Error("expected object");
    payload = parsed;
  } catch (e) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: `Invalid edit payload: ${(e as Error).message}`,
      },
      clientId,
    );
  }

  try {
    await upsertConnection(
      org,
      {
        clientId,
        serviceId,
        clientResources: payload.clientResources,
        serviceResources: payload.serviceResources,
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: `Saved connection ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `Save failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

async function handleConnectionsApprove(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST")
    return new Response("method not allowed", {
      status: 405,
    });

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }
  const services = await loadServices();
  const service = services.find(
    (s) => s.name === serviceId,
  );
  if (
    !service ||
    service.subsystem.organization.name !== org
  ) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: `Only the service owner can approve ${serviceId}.`,
      },
      clientId,
    );
  }
  const hasProposal = String(form.get("hasProposal") ?? "") === "true";
  try {
    await setConnectionApproval(
      org,
      {
        clientId,
        serviceId,
        isApproved: true,
        ...(hasProposal ? {} : { isActive: true }),
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: hasProposal
          ? `Approved proposed changes for ${clientId} → ${serviceId}`
          : `Approved ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `Approve failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

async function handleConnectionsReject(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST")
    return new Response("method not allowed", {
      status: 405,
    });

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const id = String(form.get("id") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !id || !clientId || !serviceId) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message:
          "Missing organization or connection id.",
      },
      clientId,
    );
  }
  const services = await loadServices();
  const service = services.find(
    (s) => s.name === serviceId,
  );
  if (
    !service ||
    service.subsystem.organization.name !== org
  ) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: `Only the service owner can reject ${serviceId}.`,
      },
      clientId,
    );
  }
  const hasProposal = String(form.get("hasProposal") ?? "") === "true";
  try {
    if (hasProposal) {
      await setConnectionApproval(
        org,
        { clientId, serviceId, isApproved: false },
        { accessToken: user!.accessToken },
      );
    } else {
      // Initial rejection removes the unapproved request. Rejecting proposed
      // changes clears only the proposal through the approval endpoint above.
      await deleteConnection(org, id, {
        accessToken: user!.accessToken,
      });
    }
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: hasProposal
          ? `Rejected proposed changes for ${clientId} → ${serviceId}; existing access is unchanged`
          : `Rejected and removed ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `Reject failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

async function deleteConnectionAction(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  verb: "Revoked" | "Cancelled",
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST")
    return new Response("method not allowed", {
      status: 405,
    });

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const id = String(form.get("id") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !id) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: "Missing organization or connection id.",
      },
      clientId,
    );
  }
  const label =
    clientId && serviceId
      ? `${clientId} → ${serviceId}`
      : `connection ${id}`;
  try {
    await deleteConnection(org, id, {
      accessToken: user!.accessToken,
      ...(verb === "Revoked" ? { action: "revoke" as const } : {}),
    });
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: `${verb} ${label}`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `${verb === "Revoked" ? "Revoke" : "Cancel"} failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

async function lifecycleConnectionAction(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const id = String(form.get("id") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const action = String(form.get("action") ?? "") as
    | "activate"
    | "deactivate"
    | "retry";
  if (!org || !id || !["activate", "deactivate", "retry"].includes(action)) {
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: "Missing organization, connection id, or lifecycle action." },
      clientId,
    );
  }
  try {
    await runConnectionLifecycle(
      org,
      id,
      {
        action,
        confirmAbandonRevoke:
          String(form.get("confirmAbandonRevoke") ?? "") === "true",
      },
      { accessToken: user!.accessToken },
    );
    const past = action === "activate"
      ? "Activated"
      : action === "deactivate"
      ? "Deactivated"
      : "Retried";
    return connectionsRedirect(
      req,
      org,
      { kind: "success", message: `${past} ${clientId} → ${serviceId}` },
      clientId,
    );
  } catch (e) {
    const msg = e instanceof SdxApiError
      ? `${action[0].toUpperCase()}${action.slice(1)} failed (${e.status}): ${e.body}`
      : (e as Error).message;
    return connectionsRedirect(req, org, { kind: "error", message: msg }, clientId);
  }
}

function handleConnectionsLifecycle(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  return lifecycleConnectionAction(req, user);
}

function handleConnectionsRevoke(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  return deleteConnectionAction(req, user, "Revoked");
}

function handleConnectionsDelete(
  req: Request,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  return deleteConnectionAction(req, user, "Cancelled");
}

console.log(`Server running on http://localhost:${PORT}`);
