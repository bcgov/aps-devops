// Client for the BC Public Bodies registry API. Responses are wrapped in a
// `{ payload, datetimeRequested }` envelope.

const PUBLIC_BODIES_API =
  Deno.env.get("PUBLIC_BODIES_API") ??
  "https://public-bodies.dev.api.gov.bc.ca/v1";

export interface PublicBody {
  id: string;
  staticId?: string;
  publicBodyId?: string;
  businessIdSource?: string;
  businessIdValue?: string;
  name: string;
  acronym?: string;
  sector?: string;
  typeId?: string;
  publicBodyEffectiveDate?: string | null;
  publicBodyRetiredDate?: string | null;
  [k: string]: unknown;
}

export interface PublicBodyType {
  id: string;
  staticId?: string;
  publicBodyTypeId: string;
  name: string;
  shortName?: string;
  typeEffectiveDatetime?: string | null;
  typeRetiredDatetime?: string | null;
  recordCreatedDatetime?: string | null;
  recordEndedDatetime?: string | null;
  [k: string]: unknown;
}

interface Envelope<T> {
  payload: T;
  datetimeRequested?: string;
}

// The type list is small and rarely changes, so cache it for the process.
let typesPromise: Promise<PublicBodyType[]> | null = null;

export function clearPublicBodyCache(): void {
  typesPromise = null;
}

async function fetchTypes(): Promise<PublicBodyType[]> {
  const res = await fetch(`${PUBLIC_BODIES_API}/PublicBodies/types`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const env = (await res.json()) as Envelope<PublicBodyType[]>;
  return Array.isArray(env?.payload) ? env.payload : [];
}

export function getPublicBodyTypes(): Promise<PublicBodyType[]> {
  if (!typesPromise) {
    typesPromise = fetchTypes().catch((e) => {
      typesPromise = null; // don't cache failures
      throw e;
    });
  }
  return typesPromise;
}

export async function getPublicBody(id: string): Promise<PublicBody | null> {
  const res = await fetch(
    `${PUBLIC_BODIES_API}/PublicBodies/${encodeURIComponent(id)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const env = (await res.json()) as Envelope<PublicBody>;
  return env?.payload ?? null;
}

/**
 * Find the type whose `publicBodyTypeId` matches the body's `typeId`. Multiple
 * historical records can share an id, so prefer one that is still current.
 */
export function resolvePublicBodyType(
  types: PublicBodyType[],
  typeId?: string,
): PublicBodyType | null {
  if (!typeId) return null;
  const matches = types.filter((t) => t.publicBodyTypeId === typeId);
  if (matches.length === 0) return null;
  const active = matches.find(
    (t) => !t.recordEndedDatetime && !t.typeRetiredDatetime,
  );
  return active ?? matches[0];
}
