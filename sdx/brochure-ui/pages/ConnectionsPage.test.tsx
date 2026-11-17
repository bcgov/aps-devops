import { renderToStaticMarkup } from "react-dom/server";
import {
  ClientSubsystemLink,
  ProvisionerStatusDetails,
  ScopeChips,
} from "../components/ConnectionDetails.tsx";
import { ConnectionCard } from "./ConnectionsPage.tsx";
import type { ConnectionRequest } from "../types.ts";
Deno.test("status details copy endpoint and spec, excluding status and message", () => {
  const html = renderToStaticMarkup(
    <ProvisionerStatusDetails
      status={{
        status: "provisioned",
        message: "Ready",
        endpoint: "https://edge.example/client",
        spec: "/catalog/api/spec",
      }}
    />,
  );
  for (
    const value of [
      "https://edge.example/client",
      "/catalog/api/spec",
    ]
  ) {
    if (!html.includes(`data-copy="${value}"`)) {
      throw new Error(`Missing copy control: ${value}`);
    }
  }
  if (
    html.includes('data-copy="provisioned"') ||
    html.includes('data-copy="Ready"')
  ) throw new Error("Status/message must not have copy controls");
  if (html.includes("Subsystem Client ID")) {
    throw new Error("Subsystem ID belongs beside the client link, not in status");
  }
});
Deno.test("every scope has a clipboard control", () => {
  const html = renderToStaticMarkup(
    <ScopeChips scopes={["api:read", "api:write"]} />,
  );
  for (const value of ["api:read", "api:write"]) {
    if (!html.includes(`data-copy="${value}"`)) {
      throw new Error(`Missing scope copy: ${value}`);
    }
  }
});

Deno.test("client link has an adjacent copy control without provisioner status", () => {
  const clientId = "MIN.CLIENT.APP";
  const html = renderToStaticMarkup(
    <ClientSubsystemLink clientId={clientId} />,
  );
  if (!html.includes(`href="/subsystems/${clientId}"`) || !html.includes(`>${clientId}</a><button type="button" data-copy="${clientId}"`)) {
    throw new Error("Client link must be immediately followed by a button copying the subsystem client ID");
  }
});


const actions = (
  allowed: Array<"activate" | "deactivate" | "retry" | "revoke">,
): NonNullable<ConnectionRequest["lifecycleActions"]> => ({
  activate: { allowed: allowed.includes("activate") },
  deactivate: { allowed: allowed.includes("deactivate") },
  retry: { allowed: allowed.includes("retry") },
  revoke: { allowed: allowed.includes("revoke") },
});

Deno.test("connection card uses backend lifecycle actions and has no active checkbox", () => {
  const html = renderToStaticMarkup(
    <ConnectionCard
      org="provider"
      canApprove={false}
      conn={{
        id: "connection-1",
        clientId: "MIN.CLIENT.APP",
        serviceId: "API.v1",
        isApproved: true,
        isActive: true,
        lifecycleActions: actions(["deactivate", "revoke"]),
        provisionerStatus: {
          status: "provisioned",
          message: "Provisioned",
        },
      }}
    />,
  );
  if (!html.includes(">Deactivate</button>") || !html.includes(">Revoke access</button>")) {
    throw new Error("Expected explicit Deactivate and Revoke actions");
  }
  if (html.includes("data-active-toggle")) {
    throw new Error("Customize must not expose lifecycle state as a checkbox");
  }
});

Deno.test("proposal review distinguishes approved and proposed configuration", () => {
  const html = renderToStaticMarkup(
    <ConnectionCard
      org="provider"
      canApprove
      conn={{
        id: "connection-1",
        clientId: "MIN.CLIENT.APP",
        serviceId: "API.v1",
        isApproved: true,
        isActive: true,
        requesterDetails: { scopes: ["api:read"] },
        proposedConfiguration: {
          requesterDetails: { scopes: ["api:read", "api:write"] },
        },
        lifecycleActions: actions(["deactivate", "revoke"]),
      }}
    />,
  );
  for (const text of [
    "Changes pending approval",
    "Review changes",
    "Currently approved",
    "Proposed",
    "Reject changes",
    "Approve changes",
  ]) {
    if (!html.includes(text)) throw new Error(`Missing proposal copy: ${text}`);
  }
});

Deno.test("failed revoke offers retry and confirmed activation recovery", () => {
  const lifecycleActions = actions(["activate", "retry"]);
  lifecycleActions.activate = {
    allowed: true,
    requiresConfirmation: true,
    message: "Confirm restoring access after the failed revoke.",
  };
  const html = renderToStaticMarkup(
    <ConnectionCard
      org="provider"
      canApprove={false}
      conn={{
        id: "connection-1",
        clientId: "MIN.CLIENT.APP",
        serviceId: "API.v1",
        isApproved: true,
        isActive: false,
        lifecycleIntent: {
          action: "revoke",
          operationId: "operation-1",
          phase: "deprovision",
        },
        lifecycleActions,
        provisionerStatus: {
          status: "failed",
          operation: "deprovision",
          message: "Cleanup failed",
        },
      }}
    />,
  );
  for (const text of [
    "Retry revoke",
    "Abandon revoke and activate?",
    "Confirm restoring access after the failed revoke.",
  ]) {
    if (!html.includes(text)) throw new Error(`Missing recovery UI: ${text}`);
  }
});
