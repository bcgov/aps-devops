import { renderToStaticMarkup } from "react-dom/server";
import {
  ClientSubsystemLink,
  ProvisionerStatusDetails,
  ScopeChips,
} from "../components/ConnectionDetails.tsx";
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
