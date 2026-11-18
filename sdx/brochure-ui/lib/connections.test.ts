import { setConnectionApproval } from "./connections.ts";
Deno.test("approval forwards activation in the same API request", async () => {
  const originalFetch = globalThis.fetch;
  let payload: unknown;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(String((init as { body?: unknown })?.body));
    return Response.json({ status: 200 });
  };
  try {
    await setConnectionApproval("provider", { clientId: "MIN.CLIENT.APP", serviceId: "API.v1", isApproved: true, isActive: true });
    if (JSON.stringify(payload) !== JSON.stringify({ clientId: "MIN.CLIENT.APP", serviceId: "API.v1", isApproved: true, isActive: true })) {
      throw new Error("Approval must carry explicit activation");
    }
  } finally { globalThis.fetch = originalFetch; }
});
