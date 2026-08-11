#!/usr/bin/env -S deno run --allow-net
//
// Standalone X-Entity-Sig verifier.
//
// This is the X-Entity-Sig branch of lib/verification.ts pulled out into a
// single file with a command-line entry point, so a signature can be checked
// outside the running server.
//
// X-Entity-Sig is a detached signature over the X-Edge-Token's third
// (signature) segment, verified against the keyset for the entity that
// produced the message. The entity is identified by a dotted SDX id
// (`<env>.<memberclass>.<memberid>.<subsystem>`), which maps to the keyset
// name `sdx.org.<memberclass_lower>.<memberid_lower>.<env_lower>`.
//
// When the matched JWK carries an x5c chain, the chain is validated
// (issuer/subject linkage, signatures, validity windows) and the result
// surfaced as `cert_chain_pass` in the verification details.
//
// Usage:
//   deno run --allow-net verify.ts \
//     --sig <X-Entity-Sig> --edge-token <X-Edge-Token> --entity <dotted-id>
//
// Pass the three values the calculation needs directly: the signature, the
// edge token it was computed over, and the entity (or --keyset to skip the
// dotted-id → keyset mapping). Exit code is 0 when the signature verified.

import { X509Certificate } from "node:crypto";

const KEYSET_BASE = "https://pzgw-api-gov-bc-ca.dev.api.gov.bc.ca/keysets";
const FETCH_TIMEOUT_MS = 5000;

export type VerificationStatus = "valid" | "invalid" | "missing" | "error";

export interface VerificationResult {
  status: VerificationStatus;
  message?: string;
  details?: Record<string, string>;
}

// deno-lint-ignore no-explicit-any
type Jwk = Record<string, any>;
interface Jwks {
  keys: Jwk[];
}

// --- JWKS fetching ---------------------------------------------------------

const jwksCache = new Map<string, Jwks>();
const jwksInflight = new Map<string, Promise<Jwks>>();

function fetchJwks(url: string): Promise<Jwks> {
  const cached = jwksCache.get(url);
  if (cached) return Promise.resolve(cached);
  const inflight = jwksInflight.get(url);
  if (inflight) return inflight;

  const promise = (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const jwks = (await res.json()) as Jwks;
      if (!jwks || !Array.isArray(jwks.keys)) {
        throw new Error("malformed JWKS");
      }
      jwksCache.set(url, jwks);
      return jwks;
    } finally {
      clearTimeout(t);
      jwksInflight.delete(url);
    }
  })();
  jwksInflight.set(url, promise);
  return promise;
}

// --- base64url helpers -----------------------------------------------------

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- JWS algorithm parameters ----------------------------------------------

interface AlgParams {
  importAlg: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams;
  verifyAlg: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
}

function algToParams(alg: string): AlgParams {
  switch (alg) {
    case "RS256":
      return {
        importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        verifyAlg: { name: "RSASSA-PKCS1-v1_5" },
      };
    case "RS384":
      return {
        importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
        verifyAlg: { name: "RSASSA-PKCS1-v1_5" },
      };
    case "RS512":
      return {
        importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
        verifyAlg: { name: "RSASSA-PKCS1-v1_5" },
      };
    case "PS256":
      return {
        importAlg: { name: "RSA-PSS", hash: "SHA-256" },
        verifyAlg: { name: "RSA-PSS", saltLength: 32 },
      };
    case "PS384":
      return {
        importAlg: { name: "RSA-PSS", hash: "SHA-384" },
        verifyAlg: { name: "RSA-PSS", saltLength: 48 },
      };
    case "PS512":
      return {
        importAlg: { name: "RSA-PSS", hash: "SHA-512" },
        verifyAlg: { name: "RSA-PSS", saltLength: 64 },
      };
    case "ES256":
      return {
        importAlg: { name: "ECDSA", namedCurve: "P-256" },
        verifyAlg: { name: "ECDSA", hash: "SHA-256" },
      };
    case "ES384":
      return {
        importAlg: { name: "ECDSA", namedCurve: "P-384" },
        verifyAlg: { name: "ECDSA", hash: "SHA-384" },
      };
    case "ES512":
      return {
        importAlg: { name: "ECDSA", namedCurve: "P-521" },
        verifyAlg: { name: "ECDSA", hash: "SHA-512" },
      };
    default:
      throw new Error(`unsupported alg: ${alg}`);
  }
}

function cleanJwk(jwk: Jwk): Jwk {
  // crypto.subtle.importKey rejects unknown fields like x5c/x5t/use, so trim
  // to the bits required for verification.
  const out: Jwk = { kty: jwk.kty, ext: true };
  if (jwk.kty === "EC") {
    out.crv = jwk.crv;
    out.x = jwk.x;
    out.y = jwk.y;
  } else if (jwk.kty === "RSA") {
    out.n = jwk.n;
    out.e = jwk.e;
  }
  return out;
}

async function importVerifyKey(jwk: Jwk, alg: string): Promise<CryptoKey> {
  const { importAlg } = algToParams(alg);
  return await crypto.subtle.importKey("jwk", cleanJwk(jwk), importAlg, false, [
    "verify",
  ]);
}

// Convert a DER-encoded ECDSA signature (SEQUENCE of two INTEGERs) into the
// raw R||S form WebCrypto expects. curveByteLen is 32 (P-256), 48 (P-384), or
// 66 (P-521). Throws if the input is not well-formed DER.
function derToRawEcdsa(der: Uint8Array, curveByteLen: number): Uint8Array {
  if (der[0] !== 0x30) throw new Error("not DER SEQUENCE");
  let off = 1;
  if (der[off] & 0x80) {
    const n = der[off++] & 0x7f;
    off += n;
  } else {
    off++;
  }
  if (der[off++] !== 0x02) throw new Error("expected INTEGER (r)");
  const rLen = der[off++];
  let rStart = off;
  const rEnd = off + rLen;
  while (rStart < rEnd && der[rStart] === 0) rStart++;
  off = rEnd;
  if (der[off++] !== 0x02) throw new Error("expected INTEGER (s)");
  const sLen = der[off++];
  let sStart = off;
  const sEnd = off + sLen;
  while (sStart < sEnd && der[sStart] === 0) sStart++;

  const raw = new Uint8Array(curveByteLen * 2);
  raw.set(der.subarray(rStart, rEnd), curveByteLen - (rEnd - rStart));
  raw.set(der.subarray(sStart, sEnd), curveByteLen * 2 - (sEnd - sStart));
  return raw;
}

function ecdsaCurveByteLen(alg: string): number | undefined {
  switch (alg) {
    case "ES256":
      return 32;
    case "ES384":
      return 48;
    case "ES512":
      return 66;
    default:
      return undefined;
  }
}

// --- Cert chain validation -------------------------------------------------
//
// Deno's `node:crypto` doesn't implement X509Certificate.verify(publicKey)
// or .raw or KeyObject.export(), so we do the cryptographic check ourselves
// from raw DER. For each child cert we pull out the tbsCertificate bytes,
// signatureAlgorithm OID, and signatureValue; for each parent cert we pull
// out the SubjectPublicKeyInfo (SPKI) by walking the TBSCertificate. Then
// crypto.subtle.verify ties them together. We're not anchoring to a system
// trust store — the JWKS itself is the trust anchor — but we confirm the
// chain is internally consistent and every cert is currently within its
// validity window.

interface DerTLV {
  tag: number;
  contentStart: number;
  contentEnd: number;
  next: number;
}

function readDerLength(
  bytes: Uint8Array,
  off: number,
): { length: number; off: number } {
  const first = bytes[off];
  if ((first & 0x80) === 0) return { length: first, off: off + 1 };
  const n = first & 0x7f;
  if (n === 0 || n > 4) throw new Error("bad DER length");
  let length = 0;
  let p = off + 1;
  for (let i = 0; i < n; i++) length = (length << 8) | bytes[p++];
  return { length, off: p };
}

function readDerTLV(bytes: Uint8Array, off: number): DerTLV {
  const tag = bytes[off];
  const { length, off: lenEnd } = readDerLength(bytes, off + 1);
  return {
    tag,
    contentStart: lenEnd,
    contentEnd: lenEnd + length,
    next: lenEnd + length,
  };
}

function oidToString(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const parts: number[] = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    v = (v << 7) | (bytes[i] & 0x7f);
    if ((bytes[i] & 0x80) === 0) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}

interface CertParts {
  tbs: Uint8Array;
  sigAlgOid: string;
  signature: Uint8Array;
}

function parseCertDer(der: Uint8Array): CertParts {
  const outer = readDerTLV(der, 0);
  if (outer.tag !== 0x30) throw new Error("not a SEQUENCE");
  let off = outer.contentStart;

  const tbsTLV = readDerTLV(der, off);
  if (tbsTLV.tag !== 0x30) throw new Error("expected tbsCertificate");
  const tbs = der.subarray(off, tbsTLV.next);
  off = tbsTLV.next;

  const sigAlgTLV = readDerTLV(der, off);
  if (sigAlgTLV.tag !== 0x30) throw new Error("expected signatureAlgorithm");
  const oidTLV = readDerTLV(der, sigAlgTLV.contentStart);
  if (oidTLV.tag !== 0x06) throw new Error("expected OID");
  const sigAlgOid = oidToString(
    der.subarray(oidTLV.contentStart, oidTLV.contentEnd),
  );
  off = sigAlgTLV.next;

  const sigBSTLV = readDerTLV(der, off);
  if (sigBSTLV.tag !== 0x03) throw new Error("expected BIT STRING signature");
  // BIT STRING: first content byte is the unused-bits count.
  const signature = der.subarray(
    sigBSTLV.contentStart + 1,
    sigBSTLV.contentEnd,
  );

  return { tbs, sigAlgOid, signature };
}

interface SigAlgInfo {
  importAlg: RsaHashedImportParams | EcKeyImportParams;
  verifyAlg: AlgorithmIdentifier | EcdsaParams;
  ecdsa: boolean;
  hashByteLen?: number;
}

const SIG_ALG_BY_OID: Record<string, SigAlgInfo> = {
  // RSA PKCS#1 v1.5
  "1.2.840.113549.1.1.11": {
    importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    verifyAlg: { name: "RSASSA-PKCS1-v1_5" },
    ecdsa: false,
  },
  "1.2.840.113549.1.1.12": {
    importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
    verifyAlg: { name: "RSASSA-PKCS1-v1_5" },
    ecdsa: false,
  },
  "1.2.840.113549.1.1.13": {
    importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
    verifyAlg: { name: "RSASSA-PKCS1-v1_5" },
    ecdsa: false,
  },
  // ECDSA — namedCurve is filled from the parent key's details below.
  "1.2.840.10045.4.3.2": {
    importAlg: { name: "ECDSA", namedCurve: "P-256" },
    verifyAlg: { name: "ECDSA", hash: "SHA-256" },
    ecdsa: true,
  },
  "1.2.840.10045.4.3.3": {
    importAlg: { name: "ECDSA", namedCurve: "P-384" },
    verifyAlg: { name: "ECDSA", hash: "SHA-384" },
    ecdsa: true,
  },
  "1.2.840.10045.4.3.4": {
    importAlg: { name: "ECDSA", namedCurve: "P-521" },
    verifyAlg: { name: "ECDSA", hash: "SHA-512" },
    ecdsa: true,
  },
};

// Curve OIDs that may appear as the AlgorithmIdentifier parameters inside
// an EC SPKI. Map them to WebCrypto namedCurve labels and the byte-length
// we need for DER→raw ECDSA signature conversion.
const EC_CURVE_BY_OID: Record<string, { name: string; byteLen: number }> = {
  "1.2.840.10045.3.1.7": { name: "P-256", byteLen: 32 }, // prime256v1
  "1.3.132.0.34": { name: "P-384", byteLen: 48 }, // secp384r1
  "1.3.132.0.35": { name: "P-521", byteLen: 66 }, // secp521r1
};

// Decode an x5c entry to DER. RFC 7517 says x5c entries are base64-DER, but
// in practice some registries publish base64-PEM, so we transparently
// unwrap the BEGIN/END envelope when that's what we see.
function x5cEntryToDer(b64: string): Uint8Array {
  const decoded = atob(b64.replace(/\s+/g, ""));
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  if (bytes.length > 0 && bytes[0] === 0x30) return bytes; // already DER
  const m = decoded.match(/-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/);
  if (m) {
    const inner = m[1].replace(/\s+/g, "");
    const innerBin = atob(inner);
    return Uint8Array.from(innerBin, (c) => c.charCodeAt(0));
  }
  throw new Error("x5c entry is neither DER nor PEM");
}

// Walk a TBSCertificate and return the raw bytes of its
// subjectPublicKeyInfo, plus — for EC keys — the curve OID parameter.
//
// TBSCertificate ::= SEQUENCE {
//   [0] EXPLICIT Version DEFAULT v1,
//   serialNumber          INTEGER,
//   signature             AlgorithmIdentifier,
//   issuer                Name,
//   validity              Validity,
//   subject               Name,
//   subjectPublicKeyInfo  SubjectPublicKeyInfo,
//   ...
// }
function extractSpkiFromCertDer(der: Uint8Array): {
  spki: Uint8Array;
  ecCurveOid?: string;
} {
  const outer = readDerTLV(der, 0);
  if (outer.tag !== 0x30) throw new Error("not a SEQUENCE");
  const tbsTLV = readDerTLV(der, outer.contentStart);
  if (tbsTLV.tag !== 0x30) throw new Error("expected tbsCertificate");
  let off = tbsTLV.contentStart;

  if (der[off] === 0xa0) off = readDerTLV(der, off).next; // [0] Version
  off = readDerTLV(der, off).next; // serialNumber
  off = readDerTLV(der, off).next; // signature alg
  off = readDerTLV(der, off).next; // issuer
  off = readDerTLV(der, off).next; // validity
  off = readDerTLV(der, off).next; // subject

  const spkiTLV = readDerTLV(der, off);
  if (spkiTLV.tag !== 0x30) throw new Error("expected SPKI SEQUENCE");
  const spki = der.subarray(off, spkiTLV.next);

  // SPKI ::= SEQUENCE { algorithm AlgorithmIdentifier, subjectPublicKey BIT STRING }
  const algIdTLV = readDerTLV(der, spkiTLV.contentStart);
  if (algIdTLV.tag !== 0x30) throw new Error("expected SPKI alg id");
  const algOidTLV = readDerTLV(der, algIdTLV.contentStart);
  if (algOidTLV.tag !== 0x06) throw new Error("expected SPKI alg OID");
  const paramsStart = algOidTLV.next;

  let ecCurveOid: string | undefined;
  if (paramsStart < algIdTLV.next) {
    const paramTLV = readDerTLV(der, paramsStart);
    if (paramTLV.tag === 0x06) {
      ecCurveOid = oidToString(
        der.subarray(paramTLV.contentStart, paramTLV.contentEnd),
      );
    }
  }

  return { spki, ecCurveOid };
}

async function importParentVerifyKey(
  parentDer: Uint8Array,
  sigInfo: SigAlgInfo,
): Promise<{ key: CryptoKey; ecCurveByteLen?: number }> {
  const { spki, ecCurveOid } = extractSpkiFromCertDer(parentDer);

  let importAlg: RsaHashedImportParams | EcKeyImportParams = sigInfo.importAlg;
  let ecCurveByteLen: number | undefined;
  if (sigInfo.ecdsa) {
    if (!ecCurveOid) {
      throw new Error("ECDSA cert missing curve OID parameter");
    }
    const curve = EC_CURVE_BY_OID[ecCurveOid];
    if (!curve) throw new Error(`unsupported EC curve OID ${ecCurveOid}`);
    importAlg = { name: "ECDSA", namedCurve: curve.name };
    ecCurveByteLen = curve.byteLen;
  }

  const key = await crypto.subtle.importKey(
    "spki",
    spki as BufferSource,
    importAlg,
    false,
    ["verify"],
  );
  return { key, ecCurveByteLen };
}

async function verifyCertSignedBy(
  childDer: Uint8Array,
  parentDer: Uint8Array,
): Promise<{ ok: boolean; reason?: string }> {
  let parts: CertParts;
  try {
    parts = parseCertDer(childDer);
  } catch (e) {
    return { ok: false, reason: `DER parse: ${(e as Error).message}` };
  }
  const sigInfo = SIG_ALG_BY_OID[parts.sigAlgOid];
  if (!sigInfo) {
    return {
      ok: false,
      reason: `unsupported signature alg OID ${parts.sigAlgOid}`,
    };
  }
  let imported: { key: CryptoKey; ecCurveByteLen?: number };
  try {
    imported = await importParentVerifyKey(parentDer, sigInfo);
  } catch (e) {
    return { ok: false, reason: `parent key import: ${(e as Error).message}` };
  }
  let signature: Uint8Array = parts.signature;
  if (sigInfo.ecdsa) {
    const len = imported.ecCurveByteLen ?? 32;
    try {
      signature = derToRawEcdsa(parts.signature, len);
    } catch (e) {
      return { ok: false, reason: `ECDSA sig decode: ${(e as Error).message}` };
    }
  }
  let ok: boolean;
  try {
    ok = await crypto.subtle.verify(
      sigInfo.verifyAlg,
      imported.key,
      signature as BufferSource,
      parts.tbs as BufferSource,
    );
  } catch (e) {
    return { ok: false, reason: `verify: ${(e as Error).message}` };
  }
  return ok ? { ok: true } : { ok: false, reason: "signature did not verify" };
}

// OIDs for X.520 Name attributes we extract from a cert subject.
const OID_ORGANIZATION_NAME = "2.5.4.10";
const OID_COMMON_NAME = "2.5.4.3";

// Walk a TBSCertificate's subject Name and return the value of the first
// AttributeTypeAndValue whose OID matches `oid`. We parse straight from DER
// instead of using X509Certificate.subject because that string is rendered
// differently across Node/Deno versions (legacy newline-separated vs RFC 2253
// comma-separated, with varying escaping), which made request-side leaf O
// extraction unreliable. DirectoryString values are decoded as UTF-8 — good
// enough for UTF8String / PrintableString / IA5String, which is what real
// world certs use here.
function extractSubjectAttrFromCertDer(
  der: Uint8Array,
  oid: string,
): string | undefined {
  const outer = readDerTLV(der, 0);
  if (outer.tag !== 0x30) return undefined;
  const tbsTLV = readDerTLV(der, outer.contentStart);
  if (tbsTLV.tag !== 0x30) return undefined;
  let off = tbsTLV.contentStart;

  if (der[off] === 0xa0) off = readDerTLV(der, off).next; // [0] Version
  off = readDerTLV(der, off).next; // serialNumber
  off = readDerTLV(der, off).next; // signatureAlgorithm
  off = readDerTLV(der, off).next; // issuer
  off = readDerTLV(der, off).next; // validity

  const subjectTLV = readDerTLV(der, off);
  if (subjectTLV.tag !== 0x30) return undefined;

  // RDNSequence ::= SEQUENCE OF RelativeDistinguishedName
  // RelativeDistinguishedName ::= SET OF AttributeTypeAndValue
  // AttributeTypeAndValue ::= SEQUENCE { type OID, value DirectoryString }
  let p = subjectTLV.contentStart;
  while (p < subjectTLV.contentEnd) {
    const setTLV = readDerTLV(der, p);
    if (setTLV.tag === 0x31) {
      let q = setTLV.contentStart;
      while (q < setTLV.contentEnd) {
        const atvTLV = readDerTLV(der, q);
        if (atvTLV.tag === 0x30) {
          const oidTLV = readDerTLV(der, atvTLV.contentStart);
          if (oidTLV.tag === 0x06) {
            const found = oidToString(
              der.subarray(oidTLV.contentStart, oidTLV.contentEnd),
            );
            if (found === oid) {
              const valTLV = readDerTLV(der, oidTLV.next);
              return new TextDecoder().decode(
                der.subarray(valTLV.contentStart, valTLV.contentEnd),
              );
            }
          }
        }
        q = atvTLV.next;
      }
    }
    p = setTLV.next;
  }
  return undefined;
}

interface LeafName {
  o?: string;
  cn?: string;
}

function extractLeafName(der: Uint8Array): LeafName {
  return {
    o: extractSubjectAttrFromCertDer(der, OID_ORGANIZATION_NAME),
    cn: extractSubjectAttrFromCertDer(der, OID_COMMON_NAME),
  };
}

async function validateCertChain(x5c: string[]): Promise<{
  ok: boolean;
  reason?: string;
  depth?: number;
  leaf?: LeafName;
}> {
  if (!Array.isArray(x5c) || x5c.length === 0) {
    return { ok: false, reason: "empty x5c" };
  }
  let certs: { cert: X509Certificate; der: Uint8Array }[];
  try {
    certs = x5c.map((b64) => {
      const der = x5cEntryToDer(b64);
      return { cert: new X509Certificate(der), der };
    });
  } catch (e) {
    return { ok: false, reason: `parse: ${(e as Error).message}` };
  }
  const leaf = extractLeafName(certs[0].der);
  const now = Date.now();
  for (let i = 0; i < certs.length; i++) {
    const c = certs[i].cert;
    const nb = new Date(c.validFrom).getTime();
    const na = new Date(c.validTo).getTime();
    if (now < nb)
      return { ok: false, reason: `cert[${i}] not yet valid`, leaf };
    if (now > na) return { ok: false, reason: `cert[${i}] expired`, leaf };
  }
  for (let i = 0; i < certs.length - 1; i++) {
    const child = certs[i];
    const parent = certs[i + 1];
    if (child.cert.issuer !== parent.cert.subject) {
      return {
        ok: false,
        reason: `cert[${i}] issuer != cert[${i + 1}] subject`,
        leaf,
      };
    }
    const v = await verifyCertSignedBy(child.der, parent.der);
    if (!v.ok) {
      return {
        ok: false,
        reason: `cert[${i}] -> cert[${i + 1}]: ${v.reason}`,
        leaf,
      };
    }
  }
  return { ok: true, depth: certs.length, leaf };
}

async function applyCertChainCheck(
  details: Record<string, string>,
  jwk: Jwk | undefined,
): Promise<void> {
  const x5c = jwk?.x5c;
  if (!Array.isArray(x5c) || x5c.length === 0) return;
  // Pull the leaf O/CN up-front so they surface even if chain validation later
  // throws or fails on a non-leaf cert (which shouldn't dictate whether we
  // can identify the signer).
  try {
    const leaf = extractLeafName(x5cEntryToDer(x5c[0]));
    if (leaf.o) details.cert_leaf_o = leaf.o;
    if (leaf.cn) details.cert_leaf_cn = leaf.cn;
  } catch {
    // leaf parse failure will be reported by validateCertChain below
  }
  // Defensive: if anything unexpected throws inside chain validation we
  // still surface a failure pill instead of bubbling up and zeroing out
  // the whole verification result.
  let chain: {
    ok: boolean;
    reason?: string;
    depth?: number;
    leaf?: LeafName;
  };
  try {
    chain = await validateCertChain(x5c);
  } catch (e) {
    chain = { ok: false, reason: (e as Error).message };
  }
  details.cert_chain_pass = chain.ok ? "true" : "false";
  if (typeof chain.depth === "number") {
    details.cert_chain_depth = String(chain.depth);
  }
  if (chain.leaf?.o) details.cert_leaf_o = chain.leaf.o;
  if (chain.leaf?.cn) details.cert_leaf_cn = chain.leaf.cn;
  if (!chain.ok && chain.reason) {
    details.cert_chain_reason = chain.reason;
  }
}

// --- Entity-sig verification ----------------------------------------------

function keysetUrlFor(keysetId: string): string {
  return `${KEYSET_BASE}/${encodeURIComponent(keysetId)}/.well-known/jwks.json`;
}

// Map a dotted SDX entity id (`<env>.<memberclass>.<memberid>.<subsystem>`,
// e.g. "LAB.MIN.CITZ.SDG-FE") to its keyset name
// (`sdx.org.<memberclass_lower>.<memberid_lower>.<env_lower>`,
// e.g. "sdx.org.min.citz.lab"). One keyset is published per environment.
export function dottedEntityToKeyset(dotted: string): string | undefined {
  const parts = dotted.split(".");
  if (parts.length < 3) return undefined;
  const env = parts[0]?.toLowerCase();
  const memberclass = parts[1]?.toLowerCase();
  const memberid = parts[2]?.toLowerCase();
  if (!env || !memberclass || !memberid) return undefined;
  return `sdx.org.${memberclass}.${memberid}.${env}`;
}

async function tryEntitySigVerification(
  jwks: Jwks,
  entitySig: Uint8Array,
  segment3: string,
): Promise<{
  ok: boolean;
  alg?: string;
  kid?: string;
  reason?: string;
  jwk?: Jwk;
}> {
  // Two reasonable interpretations of "signature of segment 3":
  //   1. signed bytes are the raw, base64url-decoded signature bytes
  //   2. signed bytes are the ASCII string of segment 3 (b64url chars)
  // Try both for each candidate key.
  const segment3Bytes = b64urlToBytes(segment3);
  const segment3Ascii = new TextEncoder().encode(segment3);

  for (const jwk of jwks.keys) {
    const algs: string[] = jwk.alg
      ? [jwk.alg]
      : jwk.kty === "EC"
        ? ["ES256", "ES384", "ES512"]
        : ["RS256", "PS256"];
    for (const alg of algs) {
      let params: AlgParams;
      try {
        params = algToParams(alg);
      } catch {
        continue;
      }
      let key: CryptoKey;
      try {
        key = await importVerifyKey(jwk, alg);
      } catch {
        continue;
      }
      // ECDSA sigs from OpenSSL/JOSE-detached often arrive DER-encoded
      // (leading 0x30), but WebCrypto requires raw R||S. Try both.
      const sigVariants: Uint8Array[] = [entitySig];
      const cLen = ecdsaCurveByteLen(alg);
      if (cLen && entitySig[0] === 0x30) {
        try {
          sigVariants.push(derToRawEcdsa(entitySig, cLen));
        } catch {
          // not DER — stick with the original
        }
      }
      for (const sig of sigVariants) {
        for (const data of [segment3Bytes, segment3Ascii]) {
          try {
            const ok = await crypto.subtle.verify(
              params.verifyAlg,
              key,
              sig as BufferSource,
              data as BufferSource,
            );
            if (ok) return { ok: true, alg, kid: jwk.kid, jwk };
          } catch {
            // try next
          }
        }
      }
    }
  }
  return { ok: false, reason: "no key verified entity sig" };
}

// Verify a detached X-Entity-Sig against the entity's keyset.
//
//   entitySigHeader — the X-Entity-Sig value (base64url)
//   edgeToken       — the X-Edge-Token whose 3rd (signature) segment was signed
//   keysetId        — keyset name to fetch, e.g. "sdx.org.min.citz"
//   dotted          — optional dotted entity id, surfaced in details only
export async function verifyEntitySig(
  entitySigHeader: string,
  edgeToken: string,
  keysetId: string,
  dotted?: string,
): Promise<VerificationResult> {
  let entitySig: Uint8Array;
  try {
    entitySig = b64urlToBytes(entitySigHeader);
  } catch (e) {
    return {
      status: "invalid",
      message: `bad sig encoding: ${(e as Error).message}`,
    };
  }
  const segments = edgeToken.split(".");
  if (segments.length !== 3) {
    return {
      status: "invalid",
      message: "edge token is not a JWT, cannot derive segment 3",
    };
  }
  const url = keysetUrlFor(keysetId);
  const baseDetails: Record<string, string> = { keyset: keysetId, jwks_uri: url };
  if (dotted) baseDetails.entity = dotted;
  let jwks: Jwks;
  try {
    jwks = await fetchJwks(url);
  } catch (e) {
    return {
      status: "error",
      message: `keyset fetch failed: ${(e as Error).message}`,
      details: baseDetails,
    };
  }
  const result = await tryEntitySigVerification(jwks, entitySig, segments[2]);
  const details: Record<string, string> = { ...baseDetails };
  if (result.alg) details.alg = result.alg;
  if (result.kid) details.kid = result.kid;
  if (result.ok) await applyCertChainCheck(details, result.jwk);
  return result.ok
    ? {
        status: "valid",
        message: "entity signature verified",
        details,
      }
    : {
        status: "invalid",
        message: result.reason ?? "signature did not verify",
        details,
      };
}

// --- CLI -------------------------------------------------------------------

const USAGE =
  "Usage: deno run --allow-net verify.ts --sig <X-Entity-Sig> --edge-token <X-Edge-Token> \\\n" +
  "         (--entity <dotted-id> | --keyset <keyset-id>)\n\n" +
  "Verifies a detached X-Entity-Sig against the entity's keyset.\n\n" +
  "  --sig         the X-Entity-Sig header value (base64url)\n" +
  "  --edge-token  the X-Edge-Token whose 3rd segment was signed\n" +
  "  --entity      dotted SDX id <env>.<class>.<id>.<sub>; mapped to a keyset\n" +
  "  --keyset      keyset name to fetch directly, e.g. sdx.org.min.citz\n";

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      out[a.slice(2)] = argv[++i] ?? "";
    }
  }
  return out;
}

function statusGlyph(status: VerificationStatus): string {
  switch (status) {
    case "valid":
      return "✓ VALID";
    case "invalid":
      return "✗ INVALID";
    case "missing":
      return "– MISSING";
    case "error":
      return "! ERROR";
  }
}

function printResult(r: VerificationResult): void {
  console.log(`${statusGlyph(r.status)}  ${r.message ?? ""}`);
  if (r.details) {
    for (const [k, v] of Object.entries(r.details)) {
      console.log(`    ${k}: ${v}`);
    }
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(Deno.args);
  if (Deno.args.includes("-h") || Deno.args.includes("--help")) {
    console.log(USAGE);
    return;
  }

  const sig = flags.sig;
  const edgeToken = flags["edge-token"];
  const entity = flags.entity;
  let keyset = flags.keyset;

  const missing: string[] = [];
  if (!sig) missing.push("--sig");
  if (!edgeToken) missing.push("--edge-token");
  if (!keyset && !entity) missing.push("--entity or --keyset");
  if (missing.length) {
    console.error(`Missing required argument(s): ${missing.join(", ")}\n`);
    console.error(USAGE);
    Deno.exit(2);
  }

  if (!keyset) {
    const derived = dottedEntityToKeyset(entity);
    if (!derived) {
      console.error(
        `dotted id '${entity}' is not in <env>.<class>.<id>.<sub> form`,
      );
      Deno.exit(2);
    }
    keyset = derived;
  }

  const result = await verifyEntitySig(sig, edgeToken, keyset, entity);
  printResult(result);
  Deno.exit(result.status === "valid" ? 0 : 1);
}

if (import.meta.main) {
  await main();
}
