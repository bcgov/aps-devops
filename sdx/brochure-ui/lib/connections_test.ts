import assert from "node:assert/strict";

import {
  listConnectionClientGrants,
  setConnectionClientGrantApproval,
} from "./connections.ts";

Deno.test("lists and normalizes client grants", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = ((input: string | URL | Request) => {
    requestedUrl = String(input);
    return Promise.resolve(
      Response.json([
        {
          id: "grant-1",
          integrationId: "integration-1",
          oauthClientId: "oauth-client-1",
          submissionId: "submission-1",
          status: "pending",
          scopes: [{ name: "Claims.Read" }],
          requesterDetails: {
            requester: {
              name: "Jane Requester",
              email: "jane@example.com",
            },
            scopes: [{ name: "Claims.Read" }],
            client: {
              integrationId: "integration-1",
              clientId: "oauth-client-1",
              privacyZone: "citizen",
            },
            service: {
              clientId: "claims-service",
              privacyZone: "claims",
              version: "2.4.0",
            },
            submissionId: "submission-1",
          },
        },
      ]),
    );
  }) as typeof fetch;

  try {
    const grants = await listConnectionClientGrants(
      "service org",
      "connection/1",
      { accessToken: "token-1" },
    );

    assert.match(
      requestedUrl,
      /organizations\/service%20org\/connections\/connection%2F1\/grants$/,
    );
    assert.deepEqual(grants[0].scopes, ["Claims.Read"]);
    assert.equal(
      grants[0].requesterDetails?.requester,
      "Jane Requester",
    );
    assert.equal(
      grants[0].requesterDetails?.requesterEmail,
      "jane@example.com",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("updates the exact client grant approval", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  globalThis.fetch = ((
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Promise.resolve(
      Response.json({
        id: "grant/1",
        integrationId: "integration-1",
        oauthClientId: "oauth-client-1",
        status: "approved",
        scopes: [],
      }),
    );
  }) as typeof fetch;

  try {
    const result = await setConnectionClientGrantApproval(
      "service org",
      "connection/1",
      "grant/1",
      "approved",
      { accessToken: "token-1" },
    );

    assert.match(
      requestedUrl,
      /organizations\/service%20org\/connections\/connection%2F1\/grants\/grant%2F1\/approval$/,
    );
    assert.equal(requestedInit?.method, "PUT");
    assert.deepEqual(
      JSON.parse(String(requestedInit?.body)),
      { status: "approved" },
    );
    assert.equal(
      new Headers(requestedInit?.headers).get("authorization"),
      "Bearer token-1",
    );
    assert.deepEqual(result, {
      id: "grant/1",
      integrationId: "integration-1",
      oauthClientId: "oauth-client-1",
      status: "approved",
      scopes: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
