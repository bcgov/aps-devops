import { registerOrgCertificate, requestOrgCsr } from "./org-signing.ts";

Deno.test("organization signing API requests preserve org and environment scope", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      calls.length === 1
        ? "csr: |\n  -----BEGIN CERTIFICATE REQUEST-----\n  test\n  -----END CERTIFICATE REQUEST-----\n"
        : JSON.stringify({ failed: 0 }),
    );
  };
  try {
    const csr = await requestOrgCsr("my org", "shared-rg", "lab", {
      accessToken: "test-token",
    });
    if (!csr.startsWith("-----BEGIN CERTIFICATE REQUEST-----")) {
      throw new Error("CSR not extracted");
    }
    await registerOrgCertificate("my org", "lab", "signed", "root", false);
    await registerOrgCertificate("my org", "lab", "", "", true);
    if (!calls[0].url.endsWith("/organizations/my%20org/keys")) {
      throw new Error("Incorrect keys URL");
    }
    if (
      new Headers(calls[0].init?.headers).get("authorization") !==
        "Bearer test-token"
    ) throw new Error("Missing authentication");
    const csrBody = JSON.parse(String(calls[0].init?.body));
    if (
      csrBody.runtimeGroupName !== "shared-rg" || csrBody.environment !== "lab"
    ) throw new Error("Incorrect CSR scope");
    const install = JSON.parse(String(calls[1].init?.body)).parameters;
    if (
      install.runtimeGroupName || install.environment !== "lab" ||
      install.certificatePem[0] !== "signed" || install.caCerts !== "root"
    ) throw new Error("Incorrect organization pattern inputs");
    if (!calls[2].url.endsWith("/patterns/sdx-keys.r1?action=delete")) {
      throw new Error("Incorrect removal action");
    }
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("signing API surfaces HTTP and gateway publication failures", async () => {
  const original = globalThis.fetch;
  try {
    for (
      const response of [
        new Response("denied", { status: 403 }),
        new Response('{"failed":1}'),
        new Response('{"results":"status: failed"}'),
      ]
    ) {
      globalThis.fetch = () => Promise.resolve(response);
      let rejected = false;
      try {
        await registerOrgCertificate("org", "lab", "signed", "root", false);
      } catch {
        rejected = true;
      }
      if (!rejected) {
        throw new Error("Reported a failed registration as successful");
      }
    }
  } finally {
    globalThis.fetch = original;
  }
});
