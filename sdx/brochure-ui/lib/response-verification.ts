import { Buffer } from "node:buffer";
import {
  type VerificationResult,
  verifyEdgeToken,
  verifyEntitySig,
} from "./verification.ts";

export interface ResponseVerificationInput {
  environment: string;
  memberClass: string;
  memberId: string;
  edgeToken: string;
  entitySig: string;
}
export interface ResponseVerificationConfig {
  jwksUrls: string[];
  registryBase?: string;
}
export interface ResponseVerificationCheck {
  label: string;
  passed: boolean;
  message: string;
}

function chainCheck(
  label: string,
  result: VerificationResult,
): ResponseVerificationCheck {
  return {
    label,
    passed: result.details?.cert_chain_pass !== "false",
    message: result.details?.cert_chain_pass === "false"
      ? result.details.cert_chain_reason ?? "Certificate chain failed"
      : result.details?.cert_chain_pass === "true"
      ? "Certificate chain signatures and validity dates passed"
      : "No certificate chain is published for the matching key",
  };
}

export async function verifyOrganizationResponse(
  input: ResponseVerificationInput,
  config: ResponseVerificationConfig,
) {
  const { environment, memberClass, memberId } = input;
  const expected = `sdx.org.${memberClass}.${memberId}.${environment}`
    .toLowerCase();
  const checks: ResponseVerificationCheck[] = [];
  if (!input.edgeToken || !input.entitySig) {
    return {
      verified: false,
      checks: [...checks, {
        label: "Required headers",
        passed: false,
        message: "Provide X-Edge-Token and X-Entity-Sig",
      }],
    };
  }
  // A token may only select a configured URL or an edge key set under the
  // configured registry. Do not let pasted JWT claims choose arbitrary hosts.
  const allowed = [...config.jwksUrls];
  let payload: Record<string, unknown> | undefined;
  try {
    payload = JSON.parse(
      Buffer.from(input.edgeToken.split(".")[1], "base64url").toString(),
    );
    if (config.registryBase && typeof payload?.jwks_uri === "string") {
      const base = config.registryBase.replace(/\/$/, "");
      const prefix = `${base}/sdx.edge.`;
      const suffix = `.${environment.toLowerCase()}/.well-known/jwks.json`;
      if (
        payload.jwks_uri.startsWith(prefix) && payload.jwks_uri.endsWith(suffix)
      ) {
        const name = payload.jwks_uri.slice(prefix.length, -suffix.length);
        if (/^[a-z0-9_-]+$/i.test(name)) allowed.push(payload.jwks_uri);
      }
    }
  } catch { /* Shared verifier reports malformed JWTs. */ }
  if (payload) {
    const now = Date.now() / 1000;
    const validTime = (payload.exp === undefined ||
      typeof payload.exp === "number" && now < payload.exp) &&
      (payload.nbf === undefined ||
        typeof payload.nbf === "number" && now >= payload.nbf);
    checks.push({
      label: "Edge token validity window",
      passed: validTime,
      message: validTime
        ? "Token is within any declared exp/nbf window"
        : "Edge token is expired, not yet valid, or has invalid exp/nbf claims",
    });
  }
  const [edge, entity] = await Promise.all([
    verifyEdgeToken(input.edgeToken, "response", allowed, true),
    verifyEntitySig(input.entitySig, input.edgeToken, {
      dotted: `${environment}.${memberClass}.${memberId}`,
      keysetId: expected,
    }, "response", true),
  ]);
  checks.push({
    label: "Edge token signature",
    passed: edge.status === "valid",
    message: edge.message ?? edge.status,
  });
  checks.push({
    label: "Organization signature (trust-kms)",
    passed: entity.status === "valid",
    message: entity.message ?? entity.status,
  });
  if (edge.status === "valid") {
    checks.push(chainCheck("Edge certificate chain", edge));
  }
  if (entity.status === "valid") {
    checks.push(chainCheck("Organization certificate chain", entity));
  }
  return { verified: checks.every((check) => check.passed), checks };
}
