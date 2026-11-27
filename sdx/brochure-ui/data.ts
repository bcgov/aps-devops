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
): Promise<Record<string, unknown> | null> {
  try {
    const detailRes = await fetch(
      `${SUBSYSTEMS_API}/${encodeURIComponent(clientId)}?includeAccess=true`,
    );
    if (detailRes.ok) return await detailRes.json();
  } catch (e) {
    console.error(`Failed to fetch subsystem detail for ${clientId}:`, e);
  }
  return null;
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

export function loadSubsystems(): Promise<Subsystem[]> {
  return fetchCatalogList(SUBSYSTEMS_API);
}

export function loadOrganizations(): Promise<Organization[]> {
  return fetchCatalogList(ORGANIZATIONS_API);
}

export function loadServices(): Promise<Service[]> {
  return fetchCatalogList(SERVICES_API);
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
      if (!baseUrl) return null;
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
