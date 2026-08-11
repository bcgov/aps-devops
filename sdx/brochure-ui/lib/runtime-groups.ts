import { SDX_API_ROOT, SdxApiError, type SdxCallOpts } from "./connections.ts";

export interface RuntimeGroup {
  name: string;
  environment?: string;
  host?: string;
  sdxEndpoint?: string;
  consumerEndpoint?: string;
  hostedOrganizations?: string[];
  [key: string]: unknown;
}

export type RuntimeGroupFilter = "owned" | "available";

function authHeaders(token?: string): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export async function listRuntimeGroups(
  org: string,
  filter: RuntimeGroupFilter,
  opts: SdxCallOpts = {},
): Promise<RuntimeGroup[]> {
  const url =
    `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/runtime-groups?filter=${filter}`;
  const res = await fetch(url, {
    headers: authHeaders(opts.accessToken),
    signal: opts.signal,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  return await res.json();
}
