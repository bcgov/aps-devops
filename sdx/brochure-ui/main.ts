import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "@std/yaml";
import type {
  ActivityRecord,
  JwksData,
  ResourceScope,
  Subsystem,
  Organization,
  Service,
  SiteConfig,
} from "./types.ts";
import { HomePage } from "./pages/HomePage.tsx";
import { SubsystemsPage } from "./pages/SubsystemsPage.tsx";
import { OrganizationsPage } from "./pages/OrganizationsPage.tsx";
import { OrgDetailPage } from "./pages/OrgDetailPage.tsx";
import { SubsystemDetailPage } from "./pages/SubsystemDetailPage.tsx";
import { ActivityConsolePage } from "./pages/ActivityConsolePage.tsx";
import { LogsPage } from "./pages/LogsPage.tsx";
import { MetricsPage } from "./pages/MetricsPage.tsx";
import { ConsolePage } from "./pages/ConsolePage.tsx";
import { ScopesPage } from "./pages/ScopesPage.tsx";
import { RuntimesPage } from "./pages/RuntimesPage.tsx";
import { TrafficPage } from "./pages/TrafficPage.tsx";
import { TrustPage } from "./pages/TrustPage.tsx";
import { ConnectionsPage } from "./pages/ConnectionsPage.tsx";
import { VerificationBadge } from "./components/VerificationBadge.tsx";
import { loadJwks } from "./lib/jwks.ts";
import {
  MetricsQueryNotFoundError,
  runQuery,
} from "./lib/metrics.ts";
import {
  clearJwksCache,
  verifyActivityEvent,
} from "./lib/verification.ts";
import {
  authEnabled,
  completeLogin,
  getCurrentUser,
  logout,
  startLogin,
} from "./lib/auth.ts";
import {
  deleteConnection,
  listConnections,
  listOrgActivity,
  SdxApiError,
  setConnectionApproval,
  upsertConnection,
} from "./lib/connections.ts";
import { listRuntimeGroups } from "./lib/runtime-groups.ts";
import {
  clearPublicBodyCache,
  getPublicBody,
  getPublicBodyTypes,
  resolvePublicBodyType,
  type PublicBody,
  type PublicBodyType,
} from "./lib/public-bodies.ts";
import { downloadAndSetupFonts } from "./lib/fonts.ts";
import {
  DEFAULT_ENV,
  ENVIRONMENTS,
  JWKS_URLS_BY_ENV,
  ORG_KEYSETS_URL_BY_ENV,
} from "./lib/environments.ts";

await downloadAndSetupFonts();

const SDX_API_BASE =
  Deno.env.get("SDX_API_BASE") ??
  "https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog";
const LOG_STREAM_URL =
  Deno.env.get("LOG_STREAM_URL") ??
  "https://pubsub-b8840c-dev.apps.gold.devops.gov.bc.ca/sdx/messages?history=10";
// Trust-registry JWKS sources are configured per environment in config.yaml
// (environments[].jwks_urls), each tagged with its environment id. Setting the
// JWKS_URL env var overrides config with a flat, env-agnostic comma-separated
// list (legacy/emergency escape hatch).
const JWKS_ENV_OVERRIDE = Deno.env.get("JWKS_URL");
const JWKS_SOURCES: { url: string; environment?: string }[] = JWKS_ENV_OVERRIDE
  ? JWKS_ENV_OVERRIDE.split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((url) => ({ url }))
  : ENVIRONMENTS.flatMap((env) =>
    (JWKS_URLS_BY_ENV[env.id] ?? []).map((url) => ({
      url,
      environment: env.id,
    }))
  );
const SDX_KEYSET_BASE =
  Deno.env.get("SDX_KEYSET_BASE") ??
  "https://pzgw-api-gov-bc-ca.dev.api.gov.bc.ca/keysets";

const SUBSYSTEMS_API = `${SDX_API_BASE}/subsystems`;
const ORGANIZATIONS_API = `${SDX_API_BASE}/organizations`;
const SERVICES_API = `${SDX_API_BASE}/services`;
const SCOPES_API = `${SDX_API_BASE}/scopes`;
const ACTIVITY_API = `${SDX_API_BASE}/activity`;
const ACTIVITY_PAGE_SIZE = 20;

async function loadActivity(
  first = 20,
  skip = 0,
  organization?: string,
): Promise<ActivityRecord[]> {
  const params = new URLSearchParams({
    first: String(first),
    skip: String(skip),
  });
  if (organization)
    params.set("organization", organization);
  const res = await fetch(`${ACTIVITY_API}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data)
    ? (data as ActivityRecord[])
    : [];
}

// Member Console always reads live data — never the catalog snapshot loaded at
// startup. Fetched per request.
async function loadScopes(): Promise<ResourceScope[]> {
  const res = await fetch(SCOPES_API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data)
    ? (data as ResourceScope[])
    : [];
}

const configText = await Deno.readTextFile(
  new URL("./config.yaml", import.meta.url),
);
const config = parse(configText) as SiteConfig;

let subsystems: Subsystem[] = [];
let organizations: Organization[] = [];
let services: Service[] = [];
let resourceScopes: ResourceScope[] = [];
const servicesBySubsystem = new Map<string, Service[]>();
const subsystemsByOrg = new Map<string, Subsystem[]>();

let jwksPromise: Promise<JwksData[]> | null = null;
function getJwks(): Promise<JwksData[]> {
  if (!jwksPromise) {
    jwksPromise = Promise.all(
      JWKS_SOURCES.map(async ({ url, environment }) => {
        const data = await loadJwks(url).catch((e): JwksData => ({
          url,
          fetchedAt: new Date().toISOString(),
          keys: [],
          error: (e as Error).message,
        }));
        return environment ? { ...data, environment } : data;
      }),
    );
  }
  return jwksPromise;
}

// Cache of resolved JWKS keysets, keyed by their dotted SDX keyset id
// (e.g. `sdx.sys.usr.acope.toys`, `sdx.org.usr.janis.dev`).
const keysetCache = new Map<
  string,
  Promise<JwksData | null>
>();
function clearLocalJwksCache(): void {
  jwksPromise = null;
  keysetCache.clear();
}

// Fetch a keyset by its dotted id from the given registry base URL. Resolves to
// null when the registry has no such keyset (404); other failures resolve to a
// JwksData carrying the error.
function getKeyset(
  keysetId: string,
  baseUrl: string = SDX_KEYSET_BASE,
): Promise<JwksData | null> {
  const cached = keysetCache.get(keysetId);
  if (cached) return cached;
  const url = `${baseUrl}/${encodeURIComponent(keysetId)}/.well-known/jwks.json`;
  const promise = (async (): Promise<JwksData | null> => {
    try {
      return await loadJwks(url);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "HTTP 404") return null;
      return {
        url,
        fetchedAt: new Date().toISOString(),
        keys: [],
        error: msg,
      };
    }
  })();
  keysetCache.set(keysetId, promise);
  return promise;
}

interface EnvKeyset {
  environment: string;
  source: string;
  keys: JwksData["keys"];
}

// Org and subsystem keysets are both published per environment, with a trailing
// `.<environment>` segment on the keyset id (e.g. `sdx.org.usr.janis.dev`,
// `sdx.sys.usr.janis.my-res-svc.dev`). Probe each known environment for the
// given id prefix and keep the ones that resolve with keys.
async function getKeysetsByEnvironment(
  prefix: string,
): Promise<EnvKeyset[]> {
  const results = await Promise.all(
    ENVIRONMENTS.map(async (env): Promise<EnvKeyset | null> => {
      const baseUrl = ORG_KEYSETS_URL_BY_ENV[env.id] ?? SDX_KEYSET_BASE;
      const data = await getKeyset(`${prefix}.${env.id}`, baseUrl);
      if (!data || data.error || data.keys.length === 0) {
        return null;
      }
      return {
        environment: env.id,
        source: data.url,
        keys: data.keys,
      };
    }),
  );
  return results.filter((r): r is EnvKeyset => r !== null);
}

function getSubsystemKeysets(clientId: string): Promise<EnvKeyset[]> {
  return getKeysetsByEnvironment(`sdx.sys.${clientId.toLowerCase()}`);
}

function getOrgKeysets(
  memberClass: string,
  memberId: string,
): Promise<EnvKeyset[]> {
  return getKeysetsByEnvironment(
    `sdx.org.${memberClass.toLowerCase()}.${memberId.toLowerCase()}`,
  );
}

async function fetchOasTags(
  serviceName: string,
): Promise<Map<string, string[]>> {
  const tagsByOpId = new Map<string, string[]>();
  try {
    const res = await fetch(
      `${SERVICES_API}/${encodeURIComponent(serviceName)}/oas-spec`,
    );
    if (!res.ok) return tagsByOpId;
    const spec = await res.json();
    const paths = spec?.paths;
    if (!paths || typeof paths !== "object")
      return tagsByOpId;
    for (const pathItem of Object.values(paths) as Record<
      string,
      unknown
    >[]) {
      if (!pathItem || typeof pathItem !== "object")
        continue;
      for (const op of Object.values(pathItem) as Record<
        string,
        unknown
      >[]) {
        if (!op || typeof op !== "object") continue;
        const opId = op.operationId;
        const tags = op.tags;
        if (
          typeof opId === "string" &&
          Array.isArray(tags)
        ) {
          tagsByOpId.set(
            opId,
            tags.filter(
              (t): t is string => typeof t === "string",
            ),
          );
        }
      }
    }
  } catch {
    // ignore — service may not expose an OpenAPI spec (e.g. AsyncAPI)
  }
  return tagsByOpId;
}

async function attachOperationTags(
  svcs: Service[],
): Promise<void> {
  const results = await Promise.all(
    svcs.map((s) => fetchOasTags(s.name)),
  );
  svcs.forEach((svc, i) => {
    const tagsByOpId = results[i];
    if (tagsByOpId.size === 0) return;
    for (const op of svc.operations) {
      if (op.operationId) {
        const tags = tagsByOpId.get(op.operationId);
        if (tags && tags.length > 0) op.tags = tags;
      }
    }
  });
}

async function loadCatalog(): Promise<void> {
  try {
    const [subsRes, orgRes, svcRes, scopesRes] =
      await Promise.all([
        fetch(SUBSYSTEMS_API),
        fetch(ORGANIZATIONS_API),
        fetch(SERVICES_API),
        fetch(SCOPES_API),
      ]);
    if (subsRes.ok) subsystems = await subsRes.json();
    if (orgRes.ok) organizations = await orgRes.json();
    if (svcRes.ok) services = await svcRes.json();
    if (scopesRes.ok) {
      const data = await scopesRes.json();
      resourceScopes = Array.isArray(data)
        ? (data as ResourceScope[])
        : [];
    }
    await attachOperationTags(services);
    console.log(
      `Loaded ${subsystems.length} subsystems, ${organizations.length} organizations, ${services.length} services, ${resourceScopes.length} scopes`,
    );
  } catch (e) {
    console.error("Failed to fetch API data:", e);
  }

  servicesBySubsystem.clear();
  for (const svc of services) {
    const key = svc.subsystem.clientId;
    const list = servicesBySubsystem.get(key) ?? [];
    list.push(svc);
    servicesBySubsystem.set(key, list);
  }

  subsystemsByOrg.clear();
  for (const sub of subsystems) {
    const key = sub.organization.name;
    const list = subsystemsByOrg.get(key) ?? [];
    list.push(sub);
    subsystemsByOrg.set(key, list);
  }
}

await loadCatalog();

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

const PUBLIC_DIR = new URL("./public/", import.meta.url);
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
    const file = await Deno.readFile(
      new URL(rel, PUBLIC_DIR),
    );
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

Deno.serve({ port: PORT }, async (req: Request) => {
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
    const returnTo =
      url.searchParams.get("returnTo") ?? "/";
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

  const user = await getCurrentUser(req);

  if (url.searchParams.get("refresh") === "1") {
    clearJwksCache();
    clearLocalJwksCache();
    clearPublicBodyCache();
    await loadCatalog();
  }

  if (path === "/") {
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

  if (path === "/subsystems") {
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
    const serviceCounts: Record<string, number> = {};
    for (const sub of filtered) {
      serviceCounts[sub.clientId] =
        servicesBySubsystem.get(sub.clientId)?.length ?? 0;
    }
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
    const subsystem = subsystems.find(
      (s) => s.clientId === clientId,
    );
    if (!subsystem) return notFound();
    // The list endpoint omits `access`; the per-subsystem detail response
    // carries the users and roles that have access to this subsystem.
    let subsystemDetail: Subsystem = subsystem;
    try {
      const detailRes = await fetch(
        `${SUBSYSTEMS_API}/${encodeURIComponent(clientId)}?includeAccess=true`,
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        subsystemDetail = { ...subsystem, ...detail };
      }
    } catch (e) {
      console.error(`Failed to fetch subsystem detail for ${clientId}:`, e);
    }
    const subsystemKeys = await getSubsystemKeysets(clientId);
    return htmlResponse(
      React.createElement(SubsystemDetailPage, {
        subsystem: subsystemDetail,
        services: servicesBySubsystem.get(clientId) ?? [],
        subsystemKeys,
        config,
        currentPath: path,
        user,
      }),
    );
  }

  if (path === "/organizations") {
    const subsystemCounts: Record<string, number> = {};
    for (const [org, subs] of subsystemsByOrg) {
      subsystemCounts[org] = subs.length;
    }
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

  if (path === "/runtimes") {
    return await handleRuntimes(req, url, user);
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
      const upstream = await fetch(LOG_STREAM_URL, {
        signal: req.signal,
      });
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
    const org = organizations.find(
      (o) => o.name === orgName,
    );
    if (!org) return notFound();
    const orgSubsystems =
      subsystemsByOrg.get(orgName) ?? [];
    const serviceCounts: Record<string, number> = {};
    for (const sub of orgSubsystems) {
      serviceCounts[sub.clientId] =
        servicesBySubsystem.get(sub.clientId)?.length ?? 0;
    }

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
        ACTIVITY_PAGE_SIZE,
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
        org,
        subsystems: orgSubsystems,
        serviceCounts,
        publicBody,
        publicBodyType,
        publicBodyError,
        activity,
        activityPageSize: ACTIVITY_PAGE_SIZE,
        activityError,
        orgKeys,
        config,
        currentPath: path,
        user,
      }),
    );
  }

  if (path === "/connections") {
    return await handleConnections(req, url, user);
  }
  if (path === "/connections/add") {
    return await handleConnectionsAdd(req, user);
  }
  if (path === "/connections/add-multi") {
    return await handleConnectionsAddMulti(req, user);
  }
  if (path === "/connections/edit") {
    return await handleConnectionsEdit(req, user);
  }
  if (path === "/connections/approve") {
    return await handleConnectionsApprove(req, user);
  }
  if (path === "/connections/reject") {
    return await handleConnectionsReject(req, user);
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
    const url = new URL(req.url);
    const returnTo = encodeURIComponent(
      url.pathname + url.search,
    );
    return new Response(null, {
      status: 302,
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
  org: string,
  flash: { kind: "success" | "error"; message: string },
  subsystem?: string,
): Response {
  const params = new URLSearchParams({
    org,
    flash: flash.kind,
    msg: flash.message,
  });
  if (subsystem) params.set("subsystem", subsystem);
  return redirect(`/connections?${params}`);
}

async function handleRuntimes(
  req: Request,
  url: URL,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  const selectedOrg =
    organizations.find((o) => o.name === orgName) ?? null;

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
      error =
        e instanceof SdxApiError
          ? `Failed to load runtime groups (${e.status}): ${e.body}`
          : (e as Error).message;
    }
  }

  return htmlResponse(
    React.createElement(RuntimesPage, {
      organizations,
      selectedOrg,
      ownedGroups,
      availableGroups,
      error,
      config,
      currentPath: "/runtimes",
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
  const flashKind = url.searchParams.get("flash");
  const flashMsg = url.searchParams.get("msg");
  const flash =
    flashKind === "success" || flashKind === "error"
      ? { kind: flashKind, message: flashMsg ?? "" }
      : null;

  const selectedOrg =
    organizations.find((o) => o.name === orgName) ?? null;
  const orgSubsystems = selectedOrg
    ? (subsystemsByOrg.get(selectedOrg.name) ?? [])
    : [];

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

  return htmlResponse(
    React.createElement(ConnectionsPage, {
      organizations,
      selectedOrg,
      connections,
      orgSubsystems,
      allSubsystems: subsystems,
      services,
      config,
      currentPath: "/connections",
      user: user!,
      flash,
      error,
    }),
  );
}

async function handleConnectionsAdd(
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
  const scopes = form
    .getAll("scopes")
    .map((v) => String(v))
    .filter(Boolean);
  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }
  try {
    await upsertConnection(
      org,
      {
        clientId,
        serviceId,
        scopes,
        policyVersion: "SDX.R0.00",
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      org,
      {
        kind: "success",
        message: `Requested connection ${clientId} → ${serviceId}${
          scopes.length ? ` (${scopes.join(", ")})` : ""
        }`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `Add failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

interface MultiAddItem {
  serviceId: string;
  scopes: string[];
}

async function handleConnectionsAddMulti(
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
  const raw = String(form.get("selections") ?? "[]");

  let items: MultiAddItem[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed))
      throw new Error("expected array");
    items = parsed.map((entry) => {
      const serviceId = String(entry?.serviceId ?? "");
      const scopes = Array.isArray(entry?.scopes)
        ? entry.scopes
            .map((s: unknown) => String(s))
            .filter(Boolean)
        : [];
      return { serviceId, scopes };
    });
  } catch (e) {
    return connectionsRedirect(
      org,
      {
        kind: "error",
        message: `Invalid selections payload: ${(e as Error).message}`,
      },
      clientId,
    );
  }

  if (!org || !clientId) {
    return connectionsRedirect(
      org,
      {
        kind: "error",
        message: "Missing organization or client subsystem",
      },
      clientId,
    );
  }
  const validItems = items.filter((i) => i.serviceId);
  if (validItems.length === 0) {
    return connectionsRedirect(
      org,
      {
        kind: "error",
        message:
          "Select at least one service to request access to",
      },
      clientId,
    );
  }

  const successes: string[] = [];
  const failures: string[] = [];
  for (const item of validItems) {
    try {
      await upsertConnection(
        org,
        {
          clientId,
          serviceId: item.serviceId,
          scopes: item.scopes,
          policyVersion: "SDX.R0.00",
        },
        { accessToken: user!.accessToken },
      );
      successes.push(
        item.scopes.length
          ? `${item.serviceId} (${item.scopes.join(", ")})`
          : item.serviceId,
      );
    } catch (e) {
      const msg =
        e instanceof SdxApiError
          ? `${item.serviceId}: HTTP ${e.status} ${e.body}`
          : `${item.serviceId}: ${(e as Error).message}`;
      failures.push(msg);
    }
  }

  if (failures.length === 0) {
    return connectionsRedirect(
      org,
      {
        kind: "success",
        message: `Requested ${successes.length} connection${
          successes.length === 1 ? "" : "s"
        } for ${clientId}: ${successes.join("; ")}`,
      },
      clientId,
    );
  }
  if (successes.length === 0) {
    return connectionsRedirect(
      org,
      {
        kind: "error",
        message: `All ${failures.length} requests failed: ${failures.join("; ")}`,
      },
      clientId,
    );
  }
  return connectionsRedirect(
    org,
    {
      kind: "error",
      message: `Partial success — added ${successes.length}, ${failures.length} failed: ${failures.join("; ")}`,
    },
    clientId,
  );
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
  const isApproved = String(form.get("isApproved") ?? "") === "true";
  const raw = String(form.get("payload") ?? "{}");

  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }

  let payload: {
    isActive?: boolean;
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
        isApproved,
        isActive: payload.isActive,
        clientResources: payload.clientResources,
        serviceResources: payload.serviceResources,
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
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
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }
  const service = services.find(
    (s) => s.name === serviceId,
  );
  if (
    !service ||
    service.subsystem.organization.name !== org
  ) {
    return connectionsRedirect(
      org,
      {
        kind: "error",
        message: `Only the service owner can approve ${serviceId}.`,
      },
      clientId,
    );
  }
  try {
    await setConnectionApproval(
      org,
      {
        clientId,
        serviceId,
        isApproved: true,
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      org,
      {
        kind: "success",
        message: `Approved ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `Approve failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
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
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }
  const service = services.find(
    (s) => s.name === serviceId,
  );
  if (
    !service ||
    service.subsystem.organization.name !== org
  ) {
    return connectionsRedirect(
      org,
      {
        kind: "error",
        message: `Only the service owner can reject ${serviceId}.`,
      },
      clientId,
    );
  }
  try {
    await setConnectionApproval(
      org,
      {
        clientId,
        serviceId,
        isApproved: false,
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      org,
      {
        kind: "success",
        message: `Rejected ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg =
      e instanceof SdxApiError
        ? `Reject failed (${e.status}): ${e.body}`
        : (e as Error).message;
    return connectionsRedirect(
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
    });
    return connectionsRedirect(
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
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
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
