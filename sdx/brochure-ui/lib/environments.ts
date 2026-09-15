import { parse } from "@std/yaml";
import type { SiteConfig } from "../types.ts";

// Environment ids are configured in config.yaml, so treat them as opaque
// strings rather than a fixed union.
export type EnvId = string;

// The environment list, the default environment, and the per-environment JWKS
// source lists are all driven by config.yaml so a deployment can reconfigure
// them without code changes. Read once at module load.
const config = parse(
  await Deno.readTextFile(new URL("../config.yaml", import.meta.url)),
) as SiteConfig;

export const ENVIRONMENTS: { id: EnvId; label: string }[] = (
  config.environments ?? []
).map((e) => ({ id: e.id, label: e.label }));

// Lowercased configured environment ids, for exact-match lookup in normalizeEnv.
const ENV_IDS_LOWER = new Map<string, EnvId>(
  ENVIRONMENTS.map((e) => [e.id.toLowerCase(), e.id]),
);

// Environment shown when the visitor has made no explicit choice — e.g. an
// anonymous, not-logged-in user with nothing stored in localStorage. Falls back
// to the first configured environment.
export const DEFAULT_ENV: EnvId =
  config.defaultEnvironment ?? ENVIRONMENTS[0]?.id ?? "";

// JWKS source URLs to publish on the trust registry, keyed by environment id.
export const JWKS_URLS_BY_ENV: Record<EnvId, string[]> = Object.fromEntries(
  (config.environments ?? []).map((e) => [e.id, e.jwks_urls ?? []]),
);

// Base URL of the keyset registry per environment (config `org_keysets_url`).
// Org and subsystem JWKS used to verify entity signatures are fetched from
// `<base>/<keysetId>/.well-known/jwks.json`.
export const ORG_KEYSETS_URL_BY_ENV: Record<EnvId, string> = Object.fromEntries(
  (config.environments ?? [])
    .filter((e): e is typeof e & { org_keysets_url: string } =>
      typeof e.org_keysets_url === "string" && e.org_keysets_url.length > 0
    )
    .map((e) => [e.id, e.org_keysets_url]),
);

/**
 * Resolve the keyset-registry base URL for an environment token. The token may
 * be a configured env id ("apstst") or a wire env segment carried in a keyset
 * id / dotted SDX identity ("test", "lab", …). Falls back to the default
 * environment's URL, then any configured URL — so a single-environment
 * deployment always resolves regardless of the wire env token.
 */
export function orgKeysetsUrlForEnv(env?: string | null): string | undefined {
  if (env) {
    const direct =
      ORG_KEYSETS_URL_BY_ENV[env] ?? ORG_KEYSETS_URL_BY_ENV[env.toLowerCase()];
    if (direct) return direct;
    const norm = normalizeEnv(env);
    if (norm && ORG_KEYSETS_URL_BY_ENV[norm]) return ORG_KEYSETS_URL_BY_ENV[norm];
  }
  return (
    ORG_KEYSETS_URL_BY_ENV[DEFAULT_ENV] ??
    Object.values(ORG_KEYSETS_URL_BY_ENV)[0]
  );
}

/**
 * Best-effort mapping of an arbitrary environment-ish string to one of the
 * known SDX environments. Handles common synonyms and substrings — the input
 * may be an explicit `environment` field, a gateway id, or a JWKS source URL
 * that embeds the environment (e.g. `…dev.api.gov.bc.ca`).
 *
 * Returns null when no environment can be determined; such items are treated
 * as environment-agnostic and shown under every tab.
 */
export function normalizeEnv(
  value?: string | null,
): EnvId | null {
  if (!value) return null;
  const v = value.toLowerCase();
  // An exact match against a configured environment id wins — otherwise a
  // distinct id like "apsdev" would be swallowed by the "dev" substring check
  // below and mis-filed under "dev".
  const exact = ENV_IDS_LOWER.get(v);
  if (exact) return exact;
  // Order matters: check the more specific tokens before the broader ones so a
  // host that happens to contain "dev"/"lab" elsewhere is not misclassified.
  if (v.includes("prod")) return "prod";
  if (
    v.includes("test") ||
    v.includes("uat") ||
    v.includes("qa")
  ) {
    return "test";
  }
  if (v.includes("sandbox") || v.includes("sbx")) return "sbx";
  if (v.includes("dev")) return "dev";
  if (v.includes("lab")) return "lab";
  return null;
}

/**
 * The value to place in a `data-env` attribute for client-side filtering.
 * Empty string means "no environment" — the item stays visible under every
 * tab.
 */
export function envAttr(value?: string | null): string {
  return normalizeEnv(value) ?? "";
}
