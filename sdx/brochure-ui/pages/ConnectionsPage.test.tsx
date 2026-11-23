import { ConnectionAgreement } from "../components/ConnectionAgreement.tsx";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClientSubsystemLink,
  ProvisionerStatusDetails,
  ScopeChips,
} from "../components/ConnectionDetails.tsx";
import { ConnectionCard, ConnectionsPage } from "./ConnectionsPage.tsx";
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
  if (!html.includes("data-agreement-url=") || html.includes('id="isa-')) {
    throw new Error("Connection row should load its ISA on demand");
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
    "Consumer-revoked scopes are applied immediately",
    "Consumer-revoked scopes have already been applied",
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

Deno.test("readiness requires approval, activation, and provisioning", () => {
  const render = (state: Partial<ConnectionRequest>) =>
    renderToStaticMarkup(
      <ConnectionCard
        org="provider"
        canApprove
        conn={{
          clientId: "MIN.CLIENT.APP",
          serviceId: "API.v1",
          isApproved: true,
          isActive: true,
          ...state,
        }}
      />,
    );

  const ready = render({
    provisionerStatus: { status: "provisioned", message: "" },
    proposedConfiguration: { requesterDetails: { scopes: ["api:read"] } },
  });
  if (!ready.includes("Ready</span>") ||
    !ready.includes("Current access is still available while these changes await approval")) {
    throw new Error("Expected ready status and continued access during review");
  }

  const pending = render({
    isApproved: false,
    isActive: false,
    provisionerStatus: { status: "pending", message: "" },
  });
  if (!pending.includes("Initial request is awaiting approval") ||
    pending.includes("Connection is inactive") ||
    pending.includes("Provisioning is in progress")) {
    throw new Error("Expected only the approval reason");
  }

  const failed = render({
    isActive: false,
    provisionerStatus: { status: "failed", message: "" },
  });
  if (!failed.includes("Connection is inactive") ||
    !failed.includes("Provisioning failed")) {
    throw new Error("Expected both independent reasons");
  }
});

Deno.test("ISA shows approved scopes and offers a traffic chart", () => {
  const html = renderToStaticMarkup(
    <ConnectionAgreement
      org="provider"
      id="isa-test"
      connection={{
        clientId: "MIN.CLIENT.APP",
        serviceId: "API.v1",
        isApproved: true,
        requesterDetails: {
          scopes: ["api:read"],
          client: { integrationId: "", clientId: "MIN.CLIENT.APP", privacyZone: "urn:client-zone" },
          service: { clientId: "MIN.PROVIDER.APP", privacyZone: "urn:service-zone" },
          requester: "",
          submissionId: "",
        },
        proposedConfiguration: { requesterDetails: { scopes: ["api:write"] } },
      }}
      catalog={{
        client: {
          clientId: "MIN.CLIENT.APP",
          name: "Client App",
          organization: { name: "client", title: "Client Organization" },
          member: { memberClass: "MIN", memberId: "CLIENT" },
          access: [
            { member: { name: "Client Owner", email: "owner@example.com" }, roles: ["subsystem-owner"] },
            { member: { name: "Other User" }, roles: ["subsystem-reader"] },
          ],
        },
        privacyZoneNames: new Map([
          ["urn:client-zone", "Client Privacy Zone"],
          ["urn:service-zone", "Service Privacy Zone"],
        ]),
        scopes: new Map([
          ["api:read", { name: "api:read", description: "Read records", services: [] }],
        ]),
      }}
    />,
  );
  const agreement = html.match(/<dialog id="isa-[^>]+>[\s\S]*?<\/dialog>/)?.[0] ?? "";
  for (const text of [
    "Information Sharing Agreement",
    "Client Party",
    "Service Party",
    "Read records",
    "Client Owner",
    'data-copy="owner@example.com"',
    "Client Privacy Zone",
    "Service Privacy Zone",
    "Last 30 days",
    "/api/connections/traffic?",
    ">Close</button>",
  ]) {
    if (!agreement.includes(text)) throw new Error(`Missing ISA content: ${text}`);
  }
  if (agreement.includes("urn:client-zone") || agreement.includes("urn:service-zone")) {
    throw new Error("Expected zone names without URI links");
  }
  if (agreement.includes("mailto:")) throw new Error("ISA email should be plain text");
  if (agreement.includes("Other User")) throw new Error("Non-owner appeared in the ISA");
  if (agreement.includes("api:write")) throw new Error("Proposed scope appeared as granted");
});

Deno.test("a subsystem can participate in both connection request views", () => {
  const org = {
    name: "member",
    title: "Member organization",
    member: { memberClass: "MIN", memberId: "MEMBER" },
  };
  const otherOrg = { ...org, name: "other" };
  const subsystem = { ...org, clientId: "MEMBER.APP", organization: org };
  const external = { ...otherOrg, clientId: "OTHER.APP", organization: otherOrg };
  const connection = (clientId: string, serviceId: string, subsystemId: string) => ({
    clientId,
    serviceId,
    serviceResources: { subsystemId },
  });
  for (const role of ["clients", "services"]) {
    const html = renderToStaticMarkup(
      <ConnectionsPage
        organizations={[org]}
        selectedOrg={org}
        allSubsystems={[subsystem, external]}
        services={[]}
        connections={[
          connection(subsystem.clientId, "shared-service", subsystem.clientId),
          connection("member.app", "mixed-case-self-service", "member.app"),
          connection("MIN.MEMBER.PRIVATE", "private-self-service", "MIN.MEMBER.PRIVATE"),
          {
            clientId: subsystem.clientId,
            serviceId: "shared-service-with-requester-details",
            requesterDetails: {
              client: { integrationId: "", clientId: subsystem.clientId, privacyZone: "" },
              service: { clientId: subsystem.clientId, privacyZone: "" },
              requester: "",
              scopes: [],
              submissionId: "",
            },
          },
          connection(external.clientId, "inbound-service", subsystem.clientId),
          connection(subsystem.clientId, "outbound-service", external.clientId),
        ]}
        config={{ site: { title: "", description: "", subtitle: "" }, support_url: "" }}
        currentPath={role === "clients" ? "/connections" : "/console/common-sso"}
        user={{ sub: "test", exp: 0 }}
      />,
    );
    const editAction = role === "clients"
      ? "/connections/edit"
      : "/connections/edit?returnPath=%2Fconsole%2Fcommon-sso&amp;org=member";
    if (!html.includes(`action="${editAction}"`)) {
      throw new Error(`Incorrect edit action in ${role} view`);
    }
    const expected = role === "clients" ? "inbound-service" : "outbound-service";
    const excluded = role === "clients" ? "outbound-service" : "inbound-service";
    if (!html.includes('data-connection-service="shared-service"') ||
      !html.includes('data-connection-service="mixed-case-self-service"') ||
      html.includes('data-connection-service="private-self-service"') ||
      !html.includes('data-connection-service="shared-service-with-requester-details"') ||
      !html.includes(`data-connection-service="${expected}"`) ||
      html.includes(`data-connection-service="${excluded}"`)) {
      throw new Error(`Incorrect connection ownership in ${role} view`);
    }
  }
});
