import { Buffer } from "node:buffer";
import { clearJwksCache } from "./verification.ts";
import {
  type RequestVerificationInput,
  verifyOrganizationRequest,
} from "./request-verification.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

async function request() {
  const edge = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const org = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const edgeJwk = {
    ...await crypto.subtle.exportKey("jwk", edge.publicKey),
    kid: "edge",
    alg: "ES256",
  };
  const orgJwk = {
    ...await crypto.subtle.exportKey("jwk", org.publicKey),
    kid: "org",
    alg: "ES256",
  };
  const signToken = async (payload: unknown) => {
    const data = `${encode({ alg: "ES256", kid: "edge" })}.${encode(payload)}`;
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        edge.privateKey,
        new TextEncoder().encode(data),
      ),
    );
    const sig = Buffer.from(signature).toString("base64url");
    const entitySig = Buffer.from(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          org.privateKey,
          signature,
        ),
      ),
    ).toString("base64url");
    return { edgeToken: `${data}.${sig}`, entitySig };
  };
  const signed = await signToken({
    jwks_uri: "https://edge.example/jwks",
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const input: RequestVerificationInput = {
    environment: "apsdev",
    memberClass: "MIN",
    memberId: "TEC",
    clientId: "MIN.TEC.APP",
    ...signed,
  };
  return { input, edgeJwk, orgJwk, signToken };
}

Deno.test("request verification checks both signatures and detects tampering, expiry and identity mismatch", async () => {
  const sample = await request();
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (url) => {
    seen.push(String(url));
    return Promise.resolve(
      Response.json({
        keys: [
          String(url) === "https://edge.example/jwks"
            ? sample.edgeJwk
            : sample.orgJwk,
        ],
      }),
    );
  };
  const config = { jwksUrls: ["https://edge.example/jwks"] };
  try {
    clearJwksCache();
    const success = await verifyOrganizationRequest(sample.input, config);
    assert(
      success.verified,
      "Valid edge and organization signatures did not verify",
    );
    const token = sample.input.edgeToken.split(".");
    token[1] = encode({
      jwks_uri: "https://edge.example/jwks",
      sub: "tampered",
    });
    assert(
      !(await verifyOrganizationRequest({
        ...sample.input,
        edgeToken: token.join("."),
      }, config)).verified,
      "Tampered JWT accepted",
    );
    assert(
      !(await verifyOrganizationRequest({
        ...sample.input,
        entitySig: Buffer.from("bad signature").toString("base64url"),
      }, config)).verified,
      "Bad organization signature accepted",
    );
    assert(
      !(await verifyOrganizationRequest({
        ...sample.input,
        clientId: "MIN.OTHER.APP",
      }, config)).verified,
      "Wrong organization accepted",
    );
    const expired = await sample.signToken({
      jwks_uri: "https://edge.example/jwks",
      exp: 1,
    });
    assert(
      !(await verifyOrganizationRequest(
        { ...sample.input, ...expired },
        config,
      )).verified,
      "Expired JWT accepted",
    );
    clearJwksCache();
    seen.length = 0;
    const internal = await sample.signToken({
      jwks_uri: "http://127.0.0.1/private",
    });
    assert(
      !(await verifyOrganizationRequest(
        { ...sample.input, ...internal },
        config,
      )).verified,
      "Unconfigured JWT JWKS accepted",
    );
    assert(
      !seen.some((url) => url.includes("127.0.0.1")),
      "Fetched untrusted token URL",
    );
  } finally {
    globalThis.fetch = original;
    clearJwksCache();
  }
});

Deno.test("failed certificate chain prevents overall Verified result", async () => {
  const sample = await request();
  const original = globalThis.fetch;
  globalThis.fetch = (url) =>
    Promise.resolve(
      Response.json({
        keys: [
          String(url) === "https://edge.example/jwks"
            ? sample.edgeJwk
            : { ...sample.orgJwk, x5c: ["invalid"] },
        ],
      }),
    );
  try {
    clearJwksCache();
    const result = await verifyOrganizationRequest(sample.input, {
      jwksUrls: ["https://edge.example/jwks"],
    });
    assert(
      !result.verified &&
        result.checks.some((check) =>
          check.label === "Organization certificate chain" && !check.passed
        ),
      "Failed certificate chain accepted",
    );
  } finally {
    globalThis.fetch = original;
    clearJwksCache();
  }
});
