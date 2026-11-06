import { renderToStaticMarkup } from "react-dom/server";
import {
  ProvisionerStatusDetails,
  ScopeChips,
} from "../components/ConnectionDetails.tsx";
Deno.test("status details copy identifiers, endpoint and spec, excluding status and message", () => {
  const html = renderToStaticMarkup(
    <ProvisionerStatusDetails
      clientId="MIN.CLIENT.APP"
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
      "MIN.CLIENT.APP",
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
  if (!html.includes("Subsystem Client ID")) {
    throw new Error("Missing subsystem label");
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
