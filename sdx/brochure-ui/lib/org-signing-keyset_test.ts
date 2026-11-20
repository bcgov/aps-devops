import { X509Certificate } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  certificatePayload,
  certificatesWithoutRuntime,
  fetchSigningKeyset,
  planCertificateInstall,
  signingKeyset,
} from "./org-signing-keyset.ts";
import { registerOrgCertificate } from "./org-signing.ts";
const member = { memberClass: "MIN", memberId: "TEC" };
const environment = "apsdev";
const fixture = (name: string) =>
  Deno.readTextFileSync(
    new URL(`./fixtures/org-signing/${name}.pem`, import.meta.url),
  );
const root = fixture("root");
const key = (name: string, der = false) => ({
  kty: "RSA",
  kid: `urn:ca:bc:sdx:org:min.tec:apsdev:${name}`,
  x5c: [fixture(name), root].map((pem) =>
    (der
      ? Buffer.from(new Uint8Array(new X509Certificate(pem).raw))
      : Buffer.from(pem))
      .toString("base64")
  ),
});
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const rejects = (fn: () => unknown) => {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert(failed, "Expected rejection");
};

Deno.test("replacing one runtime preserves all other certificates and strips duplicate roots", () => {
  const current = signingKeyset(
    [key("abc"), key("def", true)],
    member,
    environment,
  );
  const plan = planCertificateInstall(
    current,
    member,
    environment,
    "abc",
    fixture("abc-renewed"),
    root,
  );
  assert(plan.certificatePem.length === 2, "Lost another runtime certificate");
  assert(
    new X509Certificate(plan.certificatePem[0]).fingerprint256 ===
      new X509Certificate(fixture("abc-renewed")).fingerprint256,
    "Runtime was not renewed",
  );
  assert(
    new X509Certificate(plan.certificatePem[1]).fingerprint256 ===
      new X509Certificate(fixture("def")).fingerprint256,
    "Other runtime changed",
  );
  assert(
    plan.certificatePem.every((pem) =>
      (pem.match(/BEGIN CERTIFICATE/g) ?? []).length === 1
    ),
    "Root would be appended twice",
  );
  assert(
    plan.message.includes("abc, def") && plan.message.includes("replace") &&
      plan.message.includes("apsdev"),
    "Confirmation missing affected key set",
  );
});

Deno.test("adding a runtime retains existing set and requires new confirmation when set changes", () => {
  const current = signingKeyset([key("abc"), key("def")], member, environment);
  const plan = planCertificateInstall(
    current,
    member,
    environment,
    "ghi",
    fixture("ghi"),
    root,
  );
  assert(
    plan.certificatePem.length === 3 && plan.message.includes("add"),
    "New runtime not appended",
  );
  const changed = signingKeyset([key("abc")], member, environment);
  assert(
    plan.confirmation !==
      planCertificateInstall(
        changed,
        member,
        environment,
        "ghi",
        fixture("ghi"),
        root,
      ).confirmation,
    "Stale confirmation accepted",
  );
  assert(
    plan.confirmation !==
      planCertificateInstall(
        current,
        member,
        environment,
        "abc",
        fixture("abc-renewed"),
        root,
      ).confirmation,
    "Confirmation is not bound to certificate and runtime",
  );
});

Deno.test("rejects wrong organization, environment, runtime and keys that cannot be preserved", () => {
  const current = signingKeyset([key("abc")], member, environment);
  for (const name of ["wrong-org", "wrong-env", "def"]) {
    rejects(() =>
      planCertificateInstall(
        current,
        member,
        environment,
        "abc",
        fixture(name),
        root,
      )
    );
  }
  rejects(() =>
    signingKeyset([{ kty: "RSA", kid: "no-cert" }], member, environment)
  );
  rejects(() =>
    signingKeyset([{ kty: "RSA", x5c: ["invalid"] }], member, environment)
  );
});

Deno.test("removing one runtime keeps other runtime certificates", () => {
  const current = signingKeyset([key("abc"), key("def")], member, environment);
  const retained = certificatePayload(
    certificatesWithoutRuntime(current, "abc"),
    root,
  );
  assert(
    retained.length === 1 && retained[0].trim() === fixture("def").trim(),
    "Removal affected another runtime",
  );
});

Deno.test("reads registry before submitting merged environment certificate set", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (input, init) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(
      new Response(
        JSON.stringify(
          calls.length === 1
            ? { keys: [key("abc"), key("def")] }
            : { failed: 0 },
        ),
      ),
    );
  };
  try {
    const current = await fetchSigningKeyset(
      "https://registry.example/keyset",
      member,
      environment,
    );
    const plan = planCertificateInstall(
      current,
      member,
      environment,
      "abc",
      fixture("abc-renewed"),
      root,
    );
    await registerOrgCertificate(
      "ministry",
      environment,
      plan.certificatePem,
      root,
      false,
    );
    assert(
      calls.length === 2 && calls[0].init?.cache === "no-store",
      "Did not fetch fresh current set",
    );
    const parameters = JSON.parse(String(calls[1].init?.body)).parameters;
    assert(
      parameters.certificatePem.length === 2 && !parameters.runtimeGroupName,
      "Did not submit complete organization certificate set",
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("registry errors fail closed; a missing set starts empty", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = () => Promise.resolve(new Response("", { status: 404 }));
    const empty = await fetchSigningKeyset(
      "https://registry.example",
      member,
      environment,
    );
    assert(
      planCertificateInstall(
        empty,
        member,
        environment,
        "abc",
        fixture("abc"),
        root,
      ).certificatePem.length === 1,
      "Cannot install first certificate",
    );
    globalThis.fetch = () => Promise.resolve(new Response("", { status: 502 }));
    let failed = false;
    try {
      await fetchSigningKeyset("https://registry.example", member, environment);
    } catch {
      failed = true;
    }
    assert(failed, "An unavailable registry was treated as an empty set");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("CA-only input explains that the issued organization certificate is required", () => {
  const current = signingKeyset([], member, environment);
  let message = "";
  try {
    planCertificateInstall(current, member, environment, "abc", root, root);
  } catch (error) {
    message = (error as Error).message;
  }
  assert(
    message.includes("Only CA certificates") &&
      message.includes("signed organization certificate"),
    "Missing actionable CA-only error",
  );
});

Deno.test("accepts leaf certificate after CA in incoming and registry bundles", () => {
  const existing = key("abc");
  existing.x5c.reverse();
  const current = signingKeyset([existing], member, environment);
  const plan = planCertificateInstall(
    current,
    member,
    environment,
    "abc",
    root + "\n" + fixture("abc-renewed"),
    root,
  );
  assert(plan.certificatePem.length === 1, "Incorrect merged certificate set");
  assert(
    new X509Certificate(plan.certificatePem[0]).fingerprint256 ===
      new X509Certificate(fixture("abc-renewed")).fingerprint256,
    "Leaf certificate was not selected",
  );
});

Deno.test("recognizes issued certificate identity in subject when CA omits DNS SAN", () => {
  const pem = fixture("subject-identity");
  const current = signingKeyset([], member, environment);
  const plan = planCertificateInstall(
    current,
    member,
    environment,
    "share0",
    pem,
    root,
  );
  assert(
    plan.certificatePem.length === 1 && plan.message.includes("share0"),
    "Subject identity not recognized",
  );
  rejects(() =>
    planCertificateInstall(
      current,
      { memberClass: "MIN", memberId: "OTHER" },
      environment,
      "share0",
      pem,
      root,
    )
  );
  rejects(() =>
    planCertificateInstall(current, member, "apstst", "share0", pem, root)
  );
  rejects(() =>
    planCertificateInstall(current, member, environment, "another", pem, root)
  );
});
