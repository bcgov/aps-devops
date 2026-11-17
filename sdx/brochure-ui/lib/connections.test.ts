import {
  runConnectionLifecycle,
  setConnectionApproval,
} from "./connections.ts";

Deno.test("approval forwards activation in the same API request", async () => {
  const originalFetch = globalThis.fetch;
  let payload: unknown;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(String((init as { body?: unknown })?.body));
    return Response.json({ status: 200 });
  };
  try {
    await setConnectionApproval("provider", {
      clientId: "MIN.CLIENT.APP",
      serviceId: "API.v1",
      isApproved: true,
      isActive: true,
    });
    if (
      JSON.stringify(payload) !==
        JSON.stringify({
          clientId: "MIN.CLIENT.APP",
          serviceId: "API.v1",
          isApproved: true,
          isActive: true,
        })
    ) {
      throw new Error("Approval must carry explicit activation");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("lifecycle actions use the connection action endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; method?: string; body?: unknown } | undefined;
  globalThis.fetch = async (input, init) => {
    request = {
      url: String(input),
      method: init?.method,
      body: JSON.parse(String(init?.body)),
    };
    return Response.json({ status: 200 });
  };
  try {
    await runConnectionLifecycle("provider org", "connection/1", {
      action: "activate",
      confirmAbandonRevoke: true,
    });
    if (
      !request?.url.endsWith(
        "/organizations/provider%20org/connections/connection%2F1/lifecycle",
      ) || request.method !== "POST"
    ) {
      throw new Error(`Unexpected lifecycle request: ${JSON.stringify(request)}`);
    }
    if (
      JSON.stringify(request.body) !==
        JSON.stringify({ action: "activate", confirmAbandonRevoke: true })
    ) {
      throw new Error("Lifecycle action payload was not forwarded");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
