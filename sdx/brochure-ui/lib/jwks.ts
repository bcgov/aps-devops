import { X509Certificate } from "node:crypto";
import type { CertInfo, JwkRecord, JwksData } from "../types.ts";

const CURVE_LABELS: Record<string, string> = {
  prime256v1: "P-256",
  secp384r1: "P-384",
  secp521r1: "P-521",
};

function spkiToPem(spki: ArrayBuffer): string {
  const bytes = new Uint8Array(spki);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return [
    "-----BEGIN PUBLIC KEY-----",
    ...lines,
    "-----END PUBLIC KEY-----",
  ].join("\n");
}

async function jwkToPem(
  jwk: JwkRecord,
): Promise<{ pem?: string; error?: string }> {
  // Strip fields that confuse importKey; keep just what's needed for the
  // public key and mark it extractable.
  // deno-lint-ignore no-explicit-any
  const base: any = { kty: jwk.kty, ext: true };
  if (jwk.kty === "EC") {
    if (!jwk.crv || !jwk.x || !jwk.y) {
      return { error: "EC JWK missing crv/x/y" };
    }
    base.crv = jwk.crv;
    base.x = jwk.x;
    base.y = jwk.y;
    // SPKI encoding is identical for ECDSA and ECDH, so try ECDSA first
    // and fall back to ECDH if the runtime rejects the algorithm.
    const algs: AlgorithmIdentifier[] = [
      { name: "ECDSA", namedCurve: jwk.crv } as EcKeyImportParams,
      { name: "ECDH", namedCurve: jwk.crv } as EcKeyImportParams,
    ];
    for (const alg of algs) {
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          base,
          alg,
          true,
          alg === algs[0] ? ["verify"] : [],
        );
        const spki = await crypto.subtle.exportKey("spki", key);
        return { pem: spkiToPem(spki) };
      } catch {
        // try next
      }
    }
    return { error: `Unable to import EC ${jwk.crv} key` };
  }
  if (jwk.kty === "RSA") {
    if (!jwk.n || !jwk.e) return { error: "RSA JWK missing n/e" };
    base.n = jwk.n;
    base.e = jwk.e;
    try {
      const key = await crypto.subtle.importKey(
        "jwk",
        base,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        true,
        ["verify"],
      );
      const spki = await crypto.subtle.exportKey("spki", key);
      return { pem: spkiToPem(spki) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  return { error: `Unsupported kty: ${jwk.kty}` };
}

function extractCN(dn: string): string | undefined {
  // node returns DN segments separated by either newlines or commas
  const m = dn.match(/(?:^|[\n,])\s*CN=([^\n,]+)/);
  return m ? m[1].trim() : undefined;
}

function parseCert(b64: string, now: Date): CertInfo | { error: string } {
  try {
    // x5c entries should be base64-DER per RFC 7517, but some registries
    // (including this one) wrap a PEM-encoded cert. X509Certificate accepts
    // either when handed a Buffer.
    const decoded = atob(b64.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    const cert = new X509Certificate(bytes);

    const notBefore = new Date(cert.validFrom);
    const notAfter = new Date(cert.validTo);
    let validityState: CertInfo["validityState"];
    if (now < notBefore) validityState = "not_yet_valid";
    else if (now > notAfter) validityState = "expired";
    else validityState = "valid";

    const sans = cert.subjectAltName
      ? cert.subjectAltName.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Public-key extraction can throw on Deno's node:crypto for some curves
    // (e.g. secp521r1). Keep the rest of the cert info usable if it does.
    let publicKeyType = "unknown";
    let curve: string | undefined;
    let modulusLength: number | undefined;
    try {
      const pk = cert.publicKey;
      publicKeyType = pk.asymmetricKeyType ?? "unknown";
      // deno-lint-ignore no-explicit-any
      const details = (pk as any).asymmetricKeyDetails ?? {};
      const namedCurve: string | undefined = details.namedCurve;
      curve = namedCurve ? CURVE_LABELS[namedCurve] ?? namedCurve : undefined;
      modulusLength = details.modulusLength;
    } catch {
      // leave defaults
    }

    return {
      subject: cert.subject,
      subjectCN: extractCN(cert.subject),
      issuer: cert.issuer,
      issuerCN: extractCN(cert.issuer),
      serial: cert.serialNumber,
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      validityState,
      fingerprintSha256: cert.fingerprint256,
      publicKeyType,
      publicKeyCurve: curve,
      publicKeySize: modulusLength,
      sans,
      isCA: cert.ca ?? false,
      isSelfSigned: cert.subject === cert.issuer,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function loadAllJwks(urls: string[]): Promise<JwksData[]> {
  return await Promise.all(
    urls.map(async (url) => {
      try {
        return await loadJwks(url);
      } catch (e) {
        return {
          url,
          fetchedAt: new Date().toISOString(),
          keys: [],
          error: (e as Error).message,
        };
      }
    }),
  );
}

export async function loadJwks(url: string): Promise<JwksData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const now = new Date();
  const keys: JwkRecord[] = await Promise.all(
    // deno-lint-ignore no-explicit-any
    (json.keys ?? []).map(async (k: any): Promise<JwkRecord> => {
      const out: JwkRecord = { ...k };
      if (Array.isArray(k.x5c) && k.x5c.length > 0) {
        const certs: CertInfo[] = [];
        const errors: string[] = [];
        for (const c of k.x5c) {
          const r = parseCert(c, now);
          if ("error" in r) errors.push(r.error);
          else certs.push(r);
        }
        out.certs = certs;
        if (errors.length > 0) out.certError = errors.join("; ");
      }
      const pemResult = await jwkToPem(out);
      if (pemResult.pem) out.pem = pemResult.pem;
      if (pemResult.error) out.pemError = pemResult.error;
      return out;
    }),
  );
  return { url, fetchedAt: now.toISOString(), keys };
}
