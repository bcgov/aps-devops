import { startCatalogRefresh } from "./data.ts";
import { getCurrentUser } from "./lib/auth.ts";
import { redirectStrayConnectionAction } from "./lib/auth-redirect.ts";
import { ensureFonts } from "./lib/fonts.ts";
import { handleAbout } from "./handler/about.ts";
import {
  handleAuthCallback,
  handleLogin,
  handleLogout,
} from "./handler/auth.ts";
import {
  handleConnectionsApprove,
  handleConnectionsDelete,
  handleConnectionsEdit,
  handleConnectionsLifecycle,
  handleConnectionsReject,
  handleConnectionsRevoke,
} from "./handler/connection-actions.ts";
import { handleConnectionAgreement } from "./handler/connection-agreement.ts";
import {
  handleConnectionProvisioning,
  handleConnections,
  handleConnectionTraffic,
} from "./handler/connections.ts";
import { handleConsole } from "./handler/console.ts";
import { handleHelp } from "./handler/help.ts";
import { handleHome } from "./handler/home.ts";
import { handleRequestError, notFound } from "./handler/http.ts";
import { handleLogs, handleLogStream } from "./handler/logs.ts";
import { handleKongLogApi, handleMetrics } from "./handler/metrics.ts";
import { handleOnboardingInvite } from "./handler/onboarding-invite.ts";
import {
  handleActivityApi,
  handleOrgActivity,
  handleOrgActivityApi,
} from "./handler/org-activity.ts";
import { handleOrgSubsystems } from "./handler/org-subsystems.ts";
import { handleOrganizationDetail } from "./handler/organization-detail.ts";
import { handleOrganizations } from "./handler/organizations.ts";
import { servePublic } from "./handler/public-assets.ts";
import { handleRuntimes } from "./handler/runtimes.ts";
import { handleScopes } from "./handler/scopes.ts";
import {
  handleSubsystemApi,
  handleSubsystemDetail,
} from "./handler/subsystem-detail.ts";
import { handleSubsystems } from "./handler/subsystems.ts";
import { handleTraffic } from "./handler/traffic.ts";
import { handleTrust, handleVerifyResponse } from "./handler/trust.ts";

await ensureFonts();
startCatalogRefresh();

const PORT = Number(Deno.env.get("PORT") ?? "5500");

Deno.serve(
  { port: PORT, onError: handleRequestError },
  async (req: Request) => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.startsWith("/public/")) {
      return servePublic(path);
    }

    if (path === "/auth/login") {
      return handleLogin(req, url);
    }
    if (path === "/auth/callback") {
      return handleAuthCallback(req);
    }
    if (path === "/auth/logout") {
      return handleLogout(req);
    }

    if (path === "/api/trust/verify-response") {
      return handleVerifyResponse(req);
    }

    const user = await getCurrentUser(req);

    if (path === "/onboarding/invite") {
      return handleOnboardingInvite(url, user);
    }

    if (path === "/") {
      return handleHome(user);
    }

    if (path === "/about") {
      return handleAbout(user);
    }

    if (path === "/help") {
      return handleHelp(user);
    }

    if (path === "/subsystems") {
      return handleSubsystems(url, user);
    }

    if (path.startsWith("/subsystems/")) {
      return handleSubsystemDetail(url, user);
    }

    if (path === "/organizations") {
      return handleOrganizations(user);
    }

    if (path === "/api/activity") {
      return handleActivityApi(url);
    }

    if (path === "/logs") {
      return handleLogs(url, user);
    }

    if (path === "/metrics") {
      return handleMetrics(url, user);
    }

    if (path === "/traffic") {
      return handleTraffic(user);
    }

    if (path === "/console") {
      return handleConsole(req, user);
    }

    if (path === "/runtimes" || path === "/runtimes/signing") {
      return handleRuntimes(req, url, user);
    }

    if (path === "/org-subsystems") {
      return handleOrgSubsystems(req, url, user);
    }

    if (path.startsWith("/api/subsystems/")) {
      return handleSubsystemApi(req, url, user);
    }

    if (path === "/scopes") {
      return handleScopes(req, user);
    }

    if (path === "/org-activity") {
      return handleOrgActivity(req, url, user);
    }

    if (path === "/api/org-activity") {
      return handleOrgActivityApi(req, url, user);
    }

    if (path === "/log-stream") {
      return handleLogStream(req);
    }

    if (path === "/trust") {
      return handleTrust(user);
    }

    if (path === "/api/activity/konglog") {
      return handleKongLogApi();
    }

    if (path.startsWith("/organizations/")) {
      return handleOrganizationDetail(url, user);
    }

    if (path === "/api/connections/agreement" && req.method === "GET") {
      return handleConnectionAgreement(url, user);
    }

    if (path === "/api/connections/provisioning" && req.method === "GET") {
      return handleConnectionProvisioning(req, url, user);
    }

    if (path === "/api/connections/traffic" && req.method === "GET") {
      return handleConnectionTraffic(url, user);
    }

    if (path === "/connections" || path === "/console/common-sso") {
      return handleConnections(req, url, user);
    }
    const strayAction = redirectStrayConnectionAction(req);
    if (strayAction) return strayAction;
    if (path === "/connections/edit") {
      return handleConnectionsEdit(req, user);
    }
    if (path === "/connections/approve") {
      return handleConnectionsApprove(req, user);
    }
    if (path === "/connections/reject") {
      return handleConnectionsReject(req, user);
    }
    if (path === "/connections/lifecycle") {
      return handleConnectionsLifecycle(req, user);
    }
    if (path === "/connections/revoke") {
      return handleConnectionsRevoke(req, user);
    }
    if (path === "/connections/delete") {
      return handleConnectionsDelete(req, user);
    }

    return notFound();
  },
);

console.log(`Server running on http://localhost:${PORT}`);
