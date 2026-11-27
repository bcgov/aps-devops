import { loadServices } from "../data.ts";
import {
  deleteConnection,
  runConnectionLifecycle,
  SdxApiError,
  setConnectionApproval,
  upsertConnection,
} from "../lib/connections.ts";
import type { SessionUser } from "../lib/auth.ts";
import { requireAuth } from "./http.ts";

function connectionsRedirect(
  req: Request,
  org: string,
  flash: { kind: "success" | "error"; message: string },
  subsystem?: string,
): Response {
  const params = new URLSearchParams({
    org,
    flash: flash.kind,
    msg: flash.message,
  });
  const actionUrl = new URL(req.url);
  let state = actionUrl.searchParams;
  let returnPath = state.get("returnPath");
  if (!returnPath) {
    const referrer = req.headers.get("referer");
    if (referrer && URL.canParse(referrer)) {
      const source = new URL(referrer);
      if (
        source.origin === actionUrl.origin &&
        (source.pathname === "/connections" ||
          source.pathname === "/console/common-sso") &&
        source.searchParams.get("org") === org
      ) {
        state = source.searchParams;
        returnPath = source.pathname;
      }
    }
  }
  const destination =
    returnPath === "/console/common-sso" || state.get("role") === "services"
      ? "/console/common-sso"
      : "/connections";
  const openClients = new Set(state.getAll("openClient"));
  if (subsystem) openClients.add(subsystem);
  for (const clientId of openClients) {
    params.append("openClient", clientId);
  }
  if (subsystem) {
    params.set("subsystem", subsystem);
    const serviceId = actionUrl.searchParams.get("returnService");
    if (serviceId) params.set("returnService", serviceId);
  }
  return new Response(null, {
    status: 303,
    headers: { location: `${destination}?${params}` },
  });
}

export async function handleConnectionsEdit(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
    });
  }

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const raw = String(form.get("payload") ?? "{}");

  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }

  let payload: {
    clientResources?: Record<string, unknown>;
    serviceResources?: Record<string, unknown>;
  };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("expected object");
    }
    payload = parsed;
  } catch (e) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: `Invalid edit payload: ${(e as Error).message}`,
      },
      clientId,
    );
  }

  try {
    await upsertConnection(
      org,
      {
        clientId,
        serviceId,
        clientResources: payload.clientResources,
        serviceResources: payload.serviceResources,
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: `Saved connection ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg = e instanceof SdxApiError
      ? `Save failed (${e.status}): ${e.body}`
      : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

export async function handleConnectionsApprove(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
    });
  }

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !clientId || !serviceId) {
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: "Missing required fields" },
      clientId,
    );
  }
  const services = await loadServices();
  const service = services.find(
    (s) => s.name === serviceId,
  );
  if (
    !service ||
    service.subsystem.organization.name !== org
  ) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: `Only the service owner can approve ${serviceId}.`,
      },
      clientId,
    );
  }
  const hasProposal = String(form.get("hasProposal") ?? "") === "true";
  try {
    await setConnectionApproval(
      org,
      {
        clientId,
        serviceId,
        isApproved: true,
        ...(hasProposal ? {} : { isActive: true }),
      },
      { accessToken: user!.accessToken },
    );
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: hasProposal
          ? `Approved proposed changes for ${clientId} → ${serviceId}`
          : `Approved ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg = e instanceof SdxApiError
      ? `Approve failed (${e.status}): ${e.body}`
      : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

export async function handleConnectionsReject(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
    });
  }

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const id = String(form.get("id") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !id || !clientId || !serviceId) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: "Missing organization or connection id.",
      },
      clientId,
    );
  }
  const services = await loadServices();
  const service = services.find(
    (s) => s.name === serviceId,
  );
  if (
    !service ||
    service.subsystem.organization.name !== org
  ) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: `Only the service owner can reject ${serviceId}.`,
      },
      clientId,
    );
  }
  const hasProposal = String(form.get("hasProposal") ?? "") === "true";
  try {
    if (hasProposal) {
      await setConnectionApproval(
        org,
        { clientId, serviceId, isApproved: false },
        { accessToken: user!.accessToken },
      );
    } else {
      // Initial rejection removes the unapproved request. Rejecting proposed
      // changes clears only the proposal through the approval endpoint above.
      await deleteConnection(org, id, {
        accessToken: user!.accessToken,
      });
    }
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: hasProposal
          ? `Rejected proposed changes for ${clientId} → ${serviceId}; existing access is unchanged`
          : `Rejected and removed ${clientId} → ${serviceId}`,
      },
      clientId,
    );
  } catch (e) {
    const msg = e instanceof SdxApiError
      ? `Reject failed (${e.status}): ${e.body}`
      : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

async function deleteConnectionAction(
  req: Request,
  user: SessionUser | null,
  verb: "Revoked" | "Cancelled",
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
    });
  }

  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const id = String(form.get("id") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  if (!org || !id) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: "Missing organization or connection id.",
      },
      clientId,
    );
  }
  const label = clientId && serviceId
    ? `${clientId} → ${serviceId}`
    : `connection ${id}`;
  try {
    await deleteConnection(org, id, {
      accessToken: user!.accessToken,
      ...(verb === "Revoked" ? { action: "revoke" as const } : {}),
    });
    return connectionsRedirect(
      req,
      org,
      {
        kind: "success",
        message: `${verb} ${label}`,
      },
      clientId,
    );
  } catch (e) {
    const msg = e instanceof SdxApiError
      ? `${
        verb === "Revoked" ? "Revoke" : "Cancel"
      } failed (${e.status}): ${e.body}`
      : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

async function lifecycleConnectionAction(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const form = await req.formData();
  const org = String(form.get("org") ?? "");
  const id = String(form.get("id") ?? "");
  const clientId = String(form.get("clientId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const action = String(form.get("action") ?? "") as
    | "activate"
    | "deactivate"
    | "retry";
  if (!org || !id || !["activate", "deactivate", "retry"].includes(action)) {
    return connectionsRedirect(
      req,
      org,
      {
        kind: "error",
        message: "Missing organization, connection id, or lifecycle action.",
      },
      clientId,
    );
  }
  try {
    await runConnectionLifecycle(
      org,
      id,
      {
        action,
        confirmAbandonRevoke:
          String(form.get("confirmAbandonRevoke") ?? "") === "true",
      },
      { accessToken: user!.accessToken },
    );
    const past = action === "activate"
      ? "Activated"
      : action === "deactivate"
      ? "Deactivated"
      : "Retried";
    return connectionsRedirect(
      req,
      org,
      { kind: "success", message: `${past} ${clientId} → ${serviceId}` },
      clientId,
    );
  } catch (e) {
    const msg = e instanceof SdxApiError
      ? `${action[0].toUpperCase()}${
        action.slice(1)
      } failed (${e.status}): ${e.body}`
      : (e as Error).message;
    return connectionsRedirect(
      req,
      org,
      { kind: "error", message: msg },
      clientId,
    );
  }
}

export function handleConnectionsLifecycle(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  return lifecycleConnectionAction(req, user);
}

export function handleConnectionsRevoke(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  return deleteConnectionAction(req, user, "Revoked");
}

export function handleConnectionsDelete(
  req: Request,
  user: SessionUser | null,
): Promise<Response> {
  return deleteConnectionAction(req, user, "Cancelled");
}
