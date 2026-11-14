import { parse } from "@std/yaml";
import { SDX_API_ROOT, SdxApiError, type SdxCallOpts } from "./connections.ts";

export async function requestOrgCsr(
  org: string,
  runtimeGroupName: string,
  environment: string,
  opts: SdxCallOpts = {},
): Promise<string> {
  const url = `${SDX_API_ROOT}/organizations/${encodeURIComponent(org)}/keys`;
  const body = JSON.stringify({ runtimeGroupName, environment });
  console.log(`[SDX Member API] POST ${url} payload=${body}`);
  const res = await fetch(url, {
    method: "POST",
    headers: headers(opts),
    signal: opts.signal,
    body,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  const result = parse(await res.text()) as { csr?: string };
  if (
    typeof result?.csr !== "string" ||
    !result.csr.includes("-----BEGIN CERTIFICATE REQUEST-----")
  ) throw new Error("Keys API returned no CSR");
  return result.csr;
}

function headers(opts: SdxCallOpts): HeadersInit {
  return {
    "content-type": "application/json",
    ...(opts.accessToken
      ? { authorization: `Bearer ${opts.accessToken}` }
      : {}),
  };
}

export async function registerOrgCertificate(
  org: string,
  environment: string,
  certificatePem: string | string[],
  caCerts: string,
  remove: boolean,
  opts: SdxCallOpts = {},
): Promise<void> {
  const url = `${SDX_API_ROOT}/organizations/${
    encodeURIComponent(org)
  }/patterns/sdx-keys.r1?action=${remove ? "delete" : "apply"}`;
  const body = JSON.stringify({
    parameters: {
      environment,
      ...(!remove
        ? {
          certificatePem: Array.isArray(certificatePem)
            ? certificatePem
            : [certificatePem],
          caCerts,
        }
        : {}),
    },
  });
  console.log(`[SDX Member API] PUT ${url} payload=${body}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(opts),
    signal: opts.signal,
    body,
  });
  if (!res.ok) throw new SdxApiError(res.status, await res.text());
  const result = await res.json();
  const results = result?.results;
  const success = typeof result?.failed === "number"
    ? result.failed === 0
    : Array.isArray(results)
    ? results.every((item: { status?: string }) => item.status !== "failed")
    : typeof results === "string" && results.length > 0
    ? !(/^failed:\s*[1-9]\d*\s*$/m.test(results) ||
      /\bstatus:\s*failed\b/i.test(results))
    : remove;
  if (!success) {
    throw new Error(
      "Certificate registration failed: " + JSON.stringify(result),
    );
  }
}
