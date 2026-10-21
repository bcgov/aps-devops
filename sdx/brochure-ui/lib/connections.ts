import type {
  ActivityRecord,
  ConnectionRequest,
  ConnectionRequestInput,
} from "../types.ts";

const DEFAULT_BASE = "https://api-gov-bc-ca.dev.api.gov.bc.ca/ds/api/sdx/v1";

export const SDX_API_ROOT = Deno.env.get("SDX_API_ROOT") ?? DEFAULT_BASE;

export interface SdxCallOpts {
  accessToken?: string;
  signal?: AbortSignal;
}

export class SdxApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`SDX API ${status}: ${body || "(no body)"}`);
    this.status = status;
    this.body = body;
  }
}

function authHeaders(token?: string): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export async function listConnections(
  org: string,
  opts: SdxCallOpts = {},
): Promise<ConnectionRequest[]> {
  const url = `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/connections`;
  const res = await fetch(url, {
    headers: authHeaders(opts.accessToken),
    signal: opts.signal,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data.map(normalizeConnection) : [];
}

// Full client (subsystem) detail, scoped to the owning organization — unlike
// the public catalog's subsystem detail, this includes runtime group info.
// `name` is the plain subsystem name (Subsystem.name, e.g. "AJC-ME") — NOT
// Subsystem.clientId, which is the dotted id (e.g. "MIN.MYO.AJC-ME").
export async function getClientDetail(
  org: string,
  name: string,
  opts: SdxCallOpts = {},
): Promise<Record<string, unknown>> {
  const url =
    `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/clients/${encodeURIComponent(name)}`;
  console.log(`getClientDetail: GET ${url}`);
  const res = await fetch(url, {
    headers: authHeaders(opts.accessToken),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`getClientDetail: ${res.status} from ${url}: ${body}`);
    throw new SdxApiError(res.status, `[${url}] ${body}`);
  }
  return await res.json();
}

// The SDX API sometimes returns scopes and the requester as `{ name }` objects
// rather than the bare strings our types (and the UI) expect. Coerce them at the
// boundary so components can render `scopes`/`requester` directly as text.
function toName(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v) {
    return String((v as { name: unknown }).name ?? "");
  }
  return v == null ? "" : String(v);
}

// The requester may also carry an `email` alongside `name` when it's an object.
function toEmail(v: unknown): string | undefined {
  if (v && typeof v === "object" && "email" in v) {
    const email = (v as { email: unknown }).email;
    return email == null ? undefined : String(email);
  }
  return undefined;
}

function normalizeScopes(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map(toName).filter((s) => s !== "");
}

function normalizeConnection(c: ConnectionRequest): ConnectionRequest {
  const rd = c.requesterDetails;
  return {
    ...c,
    scopes: normalizeScopes(c.scopes) ?? c.scopes,
    requesterDetails: rd
      ? {
          ...rd,
          requester: toName(rd.requester),
          requesterEmail: toEmail(rd.requester) ?? rd.requesterEmail,
          scopes: normalizeScopes(rd.scopes) ?? rd.scopes,
        }
      : rd,
  };
}

// Org-scoped activity feed — includes both public and private activity for the
// member, unlike the public `/catalog/activity` endpoint.
export async function listOrgActivity(
  org: string,
  first: number,
  skip: number,
  opts: SdxCallOpts = {},
): Promise<ActivityRecord[]> {
  const url =
    `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/activity?first=${first}&skip=${skip}`;
  const res = await fetch(url, {
    headers: authHeaders(opts.accessToken),
    signal: opts.signal,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  const data = await res.json();
  return Array.isArray(data) ? (data as ActivityRecord[]) : [];
}

export async function deleteConnection(
  org: string,
  id: string,
  opts: SdxCallOpts = {},
): Promise<void> {
  const url = `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/connections/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(opts.accessToken),
    signal: opts.signal,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
}

/**
 * Approve or reject a pending connection request via the dedicated approval
 * endpoint: PUT /organizations/{org}/connections/approval. The connection is
 * identified by its client/service pair; `isApproved` carries the decision.
 */
export async function setConnectionApproval(
  org: string,
  input: { clientId: string; serviceId: string; isApproved: boolean },
  opts: SdxCallOpts = {},
): Promise<unknown> {
  const url =
    `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/connections/approval`;
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify(input),
    signal: opts.signal,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  return await res.json();
}

export async function upsertConnection(
  org: string,
  input: ConnectionRequestInput,
  opts: SdxCallOpts = {},
): Promise<unknown> {
  const url = `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/connections`;
  // Only the SDX.R2.00 (scoped access) policy sends scopes — R0.00/R1.00
  // requests are service-level only, and the backend doesn't expect scopes
  // on this endpoint for those policies.
  const payload = input.policyVersion === "SDX.R2.00"
    ? input
    : (() => {
      const { scopes: _scopes, ...rest } = input;
      return rest;
    })();
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  return await res.json();
}

