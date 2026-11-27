import { createHash, X509Certificate } from "node:crypto";
import { Buffer } from "node:buffer";
import type { JwkRecord } from "../types.ts";

export interface SigningMember {
  memberClass: string;
  memberId: string;
}
export interface RuntimeCertificate {
  runtime: string;
  pem: string;
  kid?: string;
}
export interface SigningKeyset {
  certificates: RuntimeCertificate[];
  revision: string;
}

function certificates(pem: string): X509Certificate[] {
  const blocks = pem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );
  if (!blocks?.length) {
    throw new Error("Provide a signed certificate in PEM format");
  }
  return blocks.map((block) => new X509Certificate(block));
}

function orderCertificateChain(chain: X509Certificate[]): X509Certificate[] {
  const leaves = chain.filter((cert) => !cert.ca);
  if (!leaves.length) {
    throw new Error(
      "Only CA certificates were provided. Paste the signed organization certificate issued for this edge runtime, followed by any intermediate CA certificates. The root CA is supplied automatically.",
    );
  }
  if (leaves.length !== 1) {
    throw new Error(
      "Paste one organization certificate with its intermediate CA certificates, rather than multiple runtime certificates.",
    );
  }
  const ordered = [leaves[0]];
  const remaining = chain.filter((cert) => cert !== leaves[0]);
  while (remaining.length) {
    const child = ordered[ordered.length - 1];
    const index = remaining.findIndex((issuer) =>
      child.checkIssued(issuer) && child.verify(issuer.publicKey)
    );
    if (index < 0) {
      throw new Error(
        "Certificate bundle includes unrelated CA certificates or is missing an intermediate CA certificate.",
      );
    }
    ordered.push(remaining.splice(index, 1)[0]);
  }
  return ordered;
}

export function certificateRuntime(
  cert: X509Certificate,
  member: SigningMember,
  environment: string,
): string {
  const prefix = `${member.memberClass}-${member.memberId}`.toLowerCase();
  const env = environment.toLowerCase();
  const names = (cert.subjectAltName ?? "").split(/,\s*/).filter((n) =>
    n.startsWith("DNS:")
  ).map((n) => n.slice(4).toLowerCase());
  const runtimes = new Set<string>();
  for (const name of names) {
    const suffix = `.${env}.servers.sdx`;
    if (name.startsWith(`${prefix}.`) && name.endsWith(suffix)) {
      const runtime = name.slice(prefix.length + 1, -suffix.length);
      if (runtime && !runtime.includes(".") && !runtime.includes("*")) {
        runtimes.add(runtime);
      }
    }
    // Older organization CSRs put the environment before the member identity.
    const legacyPrefix = `${env}-${prefix}.`;
    if (name.startsWith(legacyPrefix) && name.endsWith(".servers.sdx")) {
      const runtime = name.slice(legacyPrefix.length, -".servers.sdx".length);
      if (runtime && !runtime.includes(".") && !runtime.includes("*")) {
        runtimes.add(runtime);
      }
    }
  }
  // Some CA templates omit the requested SAN but preserve the CSR identity
  // in the subject (including older CSRs that embed serialNumber in O).
  // Only use this form when there is no DNS SAN; never override a mismatch.
  if (!names.length) {
    const cn = cert.subject.match(/(?:^|\n)CN=([^\n]+)(?:\n|$)/)?.[1];
    const serial = cert.subject.match(
      /(?:^|\n|\/)serialNumber=([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)(?=\n|$)/i,
    );
    if (
      cn?.toLowerCase() === member.memberId.toLowerCase() &&
      serial?.[1].toLowerCase() === env &&
      serial[2].toLowerCase() === member.memberClass.toLowerCase()
    ) {
      runtimes.add(serial[3].toLowerCase());
    }
  }
  if (runtimes.size !== 1) {
    throw new Error(
      `Certificate does not identify one edge runtime for ${member.memberClass}/${member.memberId} in ${environment}. Expected DNS SAN ${prefix}.<runtime>.${env}.servers.sdx; received ${
        cert.subjectAltName || "no DNS SAN"
      }.`,
    );
  }
  return [...runtimes][0];
}

function revision(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function signingKeyset(
  keys: JwkRecord[],
  member: SigningMember,
  environment: string,
): SigningKeyset {
  const entries = keys.map((key) => {
    if (!key.x5c?.length) {
      throw new Error(
        "An existing signing key has no certificate chain; cannot safely update this key set",
      );
    }
    const chain = orderCertificateChain(
      key.x5c.map((entry) => new X509Certificate(Buffer.from(entry, "base64"))),
    );
    const runtime = certificateRuntime(chain[0], member, environment);
    return {
      runtime,
      pem: chain.map((cert) => cert.toString()).join("\n"),
      kid: key.kid,
    };
  });
  return {
    certificates: entries,
    revision: revision(
      entries.map((entry) => [entry.kid, entry.pem]).sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]))
      ),
    ),
  };
}

export async function fetchSigningKeyset(
  url: string,
  member: SigningMember,
  environment: string,
): Promise<SigningKeyset> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return signingKeyset([], member, environment);
  if (!response.ok) {
    throw new Error(
      `Cannot read current organization signing keys (${response.status})`,
    );
  }
  const data = await response.json();
  if (!Array.isArray(data.keys)) {
    throw new Error("Invalid signing key set response");
  }
  return signingKeyset(data.keys, member, environment);
}

export function certificatePayload(pems: string[], caPem: string): string[] {
  const roots = new Set(certificates(caPem).map((cert) => cert.fingerprint256));
  return pems.map((pem) =>
    certificates(pem).filter((cert, index) =>
      index === 0 || !roots.has(cert.fingerprint256)
    ).map((cert) => cert.toString()).join("\n")
  );
}

export function planCertificateInstall(
  current: SigningKeyset,
  member: SigningMember,
  environment: string,
  runtime: string,
  pem: string,
  caPem: string,
) {
  const incoming = orderCertificateChain(certificates(pem));
  if (
    certificateRuntime(incoming[0], member, environment) !==
      runtime.toLowerCase()
  ) throw new Error("The certificate belongs to a different edge runtime");
  // Existing x5c chains include the root; the pattern appends configured roots.
  const roots = new Set(certificates(caPem).map((cert) => cert.fingerprint256));
  const withoutRoot = (chain: X509Certificate[]) =>
    chain.filter((cert, index) =>
      index === 0 || !roots.has(cert.fingerprint256)
    ).map((cert) => cert.toString()).join("\n");
  let replaced = false;
  const desired = current.certificates.flatMap((entry) => {
    if (entry.runtime === runtime.toLowerCase()) {
      if (replaced) return [];
      replaced = true;
      return [withoutRoot(incoming)];
    }
    return [withoutRoot(certificates(entry.pem))];
  });
  if (!replaced) desired.push(withoutRoot(incoming));
  const runtimes = [
    ...new Set(current.certificates.map((entry) => entry.runtime)),
  ].sort();
  return {
    certificatePem: desired,
    confirmation: revision([
      current.revision,
      runtime.toLowerCase(),
      environment,
      incoming.map((cert) => cert.fingerprint256),
    ]),
    message: `For ${environment} environment ${
      runtimes.length
        ? `there are certificates for edge runtimes ${runtimes.join(", ")}`
        : "there are no registered edge runtime certificates"
    }. This certificate will ${
      replaced ? "replace the certificate for" : "add a certificate for"
    } ${runtime} in this key set. Certificates for other runtimes will be retained. Are you sure?`,
  };
}

export function certificatesWithoutRuntime(
  current: SigningKeyset,
  runtime: string,
): string[] {
  return current.certificates.filter((entry) =>
    entry.runtime !== runtime.toLowerCase()
  ).map((entry) => entry.pem);
}
