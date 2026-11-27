import type {
  ActivityRecord,
  JwksData,
  Organization,
  ResourceScope,
  Service,
  Subsystem,
} from "./types.ts";
import {
  ENVIRONMENTS,
  JWKS_URLS_BY_ENV,
  ORG_KEYSETS_URL_BY_ENV,
} from "./lib/environments.ts";
import { keysForKeyset } from "./lib/keysets.ts";
import { listenForCatalogChanges } from "./lib/catalog-listener.ts";
import { loadJwks } from "./lib/jwks.ts";

const SDX_API_BASE = Deno.env.get("SDX_API_BASE") ??
  "https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1/catalog";
const LOG_STREAM_URL = Deno.env.get("LOG_STREAM_URL") ??
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
const SUBSYSTEMS_API = `${SDX_API_BASE}/subsystems`;
const ORGANIZATIONS_API = `${SDX_API_BASE}/organizations`;
const SERVICES_API = `${SDX_API_BASE}/services`;
const SCOPES_API = `${SDX_API_BASE}/scopes`;
const ACTIVITY_API = `${SDX_API_BASE}/activity`;
export const ACTIVITY_PAGE_SIZE = 20;
export const ORGANIZATION_ACTIVITY_PAGE_SIZE = 5;

export async function loadActivity(
  first = 20,
  skip = 0,
  organization?: string,
): Promise<ActivityRecord[]> {
  const params = new URLSearchParams({
    first: String(first),
    skip: String(skip),
  });
  if (organization) {
    params.set("organization", organization);
  }
  const res = await fetch(`${ACTIVITY_API}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as ActivityRecord[]) : [];
}

export async function loadScopes(): Promise<ResourceScope[]> {
  const res = await fetch(SCOPES_API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as ResourceScope[]) : [];
}

// The list endpoint omits `access`; the per-subsystem detail response carries
// the users and roles that have access to this subsystem (and any other
// fields the summary list drops). Returns null on failure — callers fall back
// to the summary already in hand.
export async function fetchSubsystemDetail(
  clientId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  try {
    const detailRes = await fetch(
      `${SUBSYSTEMS_API}/${encodeURIComponent(clientId)}?includeAccess=true`,
      { signal },
    );
    if (detailRes.ok) return await detailRes.json();
  } catch (e) {
    console.error(`Failed to fetch subsystem detail for ${clientId}:`, e);
  }
  return null;
}

export function createSubsystemDetailLoader(subsystems: Subsystem[]) {
  const partyDetails = new Map<string, Promise<Subsystem | undefined>>();
  function loadParty(partyId?: string): Promise<Subsystem | undefined> {
    if (!partyId) return Promise.resolve(undefined);
    const existing = partyDetails.get(partyId);
    if (existing) return existing;
    const pending = (async () => {
      const summary = subsystems.find((item) => item.clientId === partyId);
      if (!summary || summary.access !== undefined) return summary;
      const detail = await fetchSubsystemDetail(
        partyId,
        AbortSignal.timeout(5000),
      );
      return Array.isArray(detail?.access)
        ? { ...summary, access: detail.access }
        : summary;
    })();
    partyDetails.set(partyId, pending);
    return pending;
  }
  return loadParty;
}

export class CatalogUnavailableError extends Error {}

async function fetchCatalogList<T>(url: string): Promise<T[]> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("expected a list");
    return data as T[];
  } catch (cause) {
    throw new CatalogUnavailableError(`Failed to load ${url}`, { cause });
  }
}

const CATALOG_CACHE_TTL_MS = 60_000;
const MAX_REFRESH_PERIOD_SECONDS = 2_147_483;
let catalogListenerConnected = false;
let catalogRefreshPeriodMs = 0;
let catalogRevision = 0;

function invalidateCatalog(): void {
  catalogRevision++;
}

function catalogCacheEnabled(): boolean {
  return catalogListenerConnected || catalogRefreshPeriodMs > 0;
}

function catalogLoader<T>(url: string) {
  let cached: { revision: number; expiresAt: number; data: T[] } | undefined;
  let pending: { revision: number; result: Promise<T[]> } | undefined;

  function refresh(): Promise<T[]> {
    const revision = catalogRevision;
    if (pending?.revision === revision) return pending.result;

    const result = fetchCatalogList<T>(url).then((data) => {
      if (revision === catalogRevision) {
        cached = {
          revision,
          expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
          data,
        };
      }
      return data;
    }).finally(() => {
      if (pending?.result === result) pending = undefined;
    });
    pending = { revision, result };
    return result;
  }

  function load(fresh = false): Promise<T[]> {
    if (fresh || !catalogCacheEnabled()) return fetchCatalogList<T>(url);

    if (
      cached?.revision === catalogRevision &&
      (catalogRefreshPeriodMs > 0 || cached.expiresAt > Date.now())
    ) {
      return Promise.resolve(cached.data);
    }
    return refresh();
  }

  return { load, refresh };
}

const subsystemsCatalog = catalogLoader<Subsystem>(SUBSYSTEMS_API);
const organizationsCatalog = catalogLoader<Organization>(ORGANIZATIONS_API);
const servicesCatalog = catalogLoader<Service>(SERVICES_API);

export const loadSubsystems = subsystemsCatalog.load;
export const loadOrganizations = organizationsCatalog.load;
export const loadServices = servicesCatalog.load;

export async function loadConnectionOrganizations(
  orgName: string,
): Promise<Organization[]> {
  const organizations = await loadOrganizations();
  if (
    catalogCacheEnabled() && orgName &&
    !organizations.some((org) => org.name === orgName)
  ) {
    return loadOrganizations(true);
  }
  return organizations;
}

function startPeriodicCatalogRefresh(periodMs: number): void {
  let refreshing = false;
  async function refreshCatalog(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    const results = await Promise.allSettled([
      subsystemsCatalog.refresh(),
      organizationsCatalog.refresh(),
      servicesCatalog.refresh(),
    ]);
    refreshing = false;
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("Periodic catalogue refresh failed", result.reason);
      }
    }
  }

  void refreshCatalog();
  setInterval(() => void refreshCatalog(), periodMs);
}

export function startCatalogRefresh(): void {
  const period = Deno.env.get("SDX_CATALOG_REFRESH_PERIOD_SECONDS")?.trim() ||
    "0";
  const seconds = Number(period);
  if (
    !/^\d+$/.test(period) || !Number.isSafeInteger(seconds) ||
    seconds > MAX_REFRESH_PERIOD_SECONDS
  ) {
    throw new Error(
      `SDX_CATALOG_REFRESH_PERIOD_SECONDS must be an integer between 0 and ${MAX_REFRESH_PERIOD_SECONDS}`,
    );
  }
  catalogRefreshPeriodMs = seconds * 1_000;
  const listenerEnabled =
    Deno.env.get("SDX_CATALOG_LISTENER_ENABLED") === "true";
  if (listenerEnabled) startCatalogListener();
  if (catalogRefreshPeriodMs > 0) {
    startPeriodicCatalogRefresh(catalogRefreshPeriodMs);
  }
}

function startCatalogListener(): void {
  const connectionString = Deno.env.get("SDX_CATALOG_DATABASE_URL");
  if (!connectionString) {
    throw new Error(
      "SDX_CATALOG_DATABASE_URL is required when the catalogue listener is enabled",
    );
  }
  try {
    const url = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      url.pathname.length < 2
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "SDX_CATALOG_DATABASE_URL must be a PostgreSQL URL with a host and database",
    );
  }

  void listenForCatalogChanges(
    connectionString,
    (connected) => {
      catalogListenerConnected = connected;
      // Subscribing again covers writes missed during a disconnect.
      if (connected || catalogRefreshPeriodMs === 0) invalidateCatalog();
    },
    invalidateCatalog,
  );
}

export function countBy<T>(
  items: T[],
  key: (item: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = Object.create(null);
  for (const item of items) {
    const id = key(item);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

const TRUST_CACHE_TTL_MS = 60_000;
let jwksExpiresAt = 0;
let jwksPromise: Promise<JwksData[]> | null = null;
export function getJwks(): Promise<JwksData[]> {
  if (!jwksPromise || jwksExpiresAt <= Date.now()) {
    jwksExpiresAt = Date.now() + TRUST_CACHE_TTL_MS;
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
  { expiresAt: number; promise: Promise<JwksData | null> }
>();

// Fetch a keyset by its dotted id from the given registry base URL. Resolves to
// null when the registry has no such keyset (404); other failures resolve to a
// JwksData carrying the error.
function getKeyset(
  keysetId: string,
  baseUrl: string,
): Promise<JwksData | null> {
  const cached = keysetCache.get(keysetId);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const url = `${baseUrl}/${
    encodeURIComponent(keysetId)
  }/.well-known/jwks.json`;
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
  keysetCache.set(keysetId, {
    expiresAt: Date.now() + TRUST_CACHE_TTL_MS,
    promise,
  });
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
      const baseUrl = ORG_KEYSETS_URL_BY_ENV[env.id];
      if (!baseUrl) {
        // Deployments may configure only aggregate Trust registry sources.
        // Those already contain the published org/subsystem keys.
        const sources = await getJwks();
        const matches = sources.flatMap((source) => {
          const keys = keysForKeyset(source.keys, prefix, env.id);
          return keys.length ? [{ source: source.url, keys }] : [];
        });
        if (!matches.length) return null;
        return {
          environment: env.id,
          source: matches[0].source,
          keys: matches[0].keys,
        };
      }
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

export function getSubsystemKeysets(clientId: string): Promise<EnvKeyset[]> {
  return getKeysetsByEnvironment(`sdx.sys.${clientId.toLowerCase()}`);
}

export function getOrgKeysets(
  memberClass: string,
  memberId: string,
): Promise<EnvKeyset[]> {
  return getKeysetsByEnvironment(
    `sdx.org.${memberClass.toLowerCase()}.${memberId.toLowerCase()}`,
  );
}

async function fetchOasTags(
  serviceName: string,
  signal: AbortSignal,
): Promise<Map<string, string[]>> {
  const tagsByOpId = new Map<string, string[]>();
  try {
    const res = await fetch(
      `${SERVICES_API}/${encodeURIComponent(serviceName)}/oas-spec`,
      { signal },
    );
    if (!res.ok) return tagsByOpId;
    const spec = await res.json();
    const paths = spec?.paths;
    if (!paths || typeof paths !== "object") {
      return tagsByOpId;
    }
    for (
      const pathItem of Object.values(paths) as Record<
        string,
        unknown
      >[]
    ) {
      if (!pathItem || typeof pathItem !== "object") {
        continue;
      }
      for (
        const op of Object.values(pathItem) as Record<
          string,
          unknown
        >[]
      ) {
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

export async function attachOperationTags(services: Service[]): Promise<void> {
  // Limit the concurrency and total time spent on optional spec enrichment.
  const batchSize = 4;
  const signal = AbortSignal.timeout(3_000);
  for (
    let start = 0;
    start < services.length && !signal.aborted;
    start += batchSize
  ) {
    await Promise.all(
      services.slice(start, start + batchSize).map(async (service) => {
        if (
          service.operations.every((op) => !op.operationId || op.tags?.length)
        ) {
          return;
        }
        const tagsByOpId = await fetchOasTags(service.name, signal);
        for (const operation of service.operations) {
          if (!operation.operationId || operation.tags?.length) continue;
          const tags = tagsByOpId.get(operation.operationId);
          if (tags?.length) operation.tags = tags;
        }
      }),
    );
  }
}

// The summary list omits access. Fall back to the summary if detail is unavailable.
export async function loadOrganizationDetail(
  org: Organization,
): Promise<Organization> {
  try {
    const response = await fetch(
      `${ORGANIZATIONS_API}/${encodeURIComponent(org.name)}?includeAccess=true`,
    );
    if (response.ok) {
      const detail = await response.json();
      return { ...org, ...detail };
    }
  } catch (error) {
    console.error(
      `Failed to fetch organization detail for ${org.name}:`,
      error,
    );
  }
  return org;
}

export function openLogStream(signal: AbortSignal): Promise<Response> {
  return fetch(LOG_STREAM_URL, { signal });
}

const PUBLIC_DIR = new URL("./public/", import.meta.url);

export function readPublicAsset(
  relativePath: string,
): Promise<Uint8Array<ArrayBuffer>> {
  return Deno.readFile(new URL(relativePath, PUBLIC_DIR));
}
