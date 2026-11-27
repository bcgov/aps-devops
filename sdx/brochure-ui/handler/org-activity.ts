import React from "react";
import {
  ACTIVITY_PAGE_SIZE,
  loadActivity,
  loadOrganizations,
} from "../data.ts";
import { config } from "../lib/config.ts";
import type { ActivityRecord } from "../types.ts";
import { ActivityConsolePage } from "../pages/ActivityConsolePage.tsx";
import { listOrgActivity, SdxApiError } from "../lib/connections.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, requireAuth } from "./http.ts";

export async function handleOrgActivity(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "";
  const organizations = await loadOrganizations();
  const selectedOrg = organizations.find((o) => o.name === orgName) ?? null;

  let activity: ActivityRecord[] = [];
  let error: string | null = null;
  if (selectedOrg) {
    try {
      activity = await listOrgActivity(
        selectedOrg.name,
        ACTIVITY_PAGE_SIZE,
        0,
        { accessToken: user!.accessToken },
      );
    } catch (e) {
      error = e instanceof SdxApiError
        ? `Failed to load activity (${e.status}): ${e.body}`
        : (e as Error).message;
    }
  }

  return htmlResponse(
    React.createElement(ActivityConsolePage, {
      organizations,
      selectedOrg,
      activity,
      pageSize: ACTIVITY_PAGE_SIZE,
      error,
      config,
      currentPath: "/org-activity",
      user: user!,
    }),
  );
}

export async function handleOrgActivityApi(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const orgName = url.searchParams.get("org") ?? "unknown";
  if (orgName === "unknown") {
    return new Response("unknown organization", {
      status: 400,
      headers: { "content-type": "text/plain" },
    });
  }
  const first = Math.min(
    Math.max(
      Number(url.searchParams.get("first") ?? "20") || 20,
      1,
    ),
    100,
  );
  const skip = Math.max(
    Number(url.searchParams.get("skip") ?? "0") || 0,
    0,
  );
  try {
    const records = await listOrgActivity(
      orgName,
      first,
      skip,
      { accessToken: user!.accessToken },
    );
    return Response.json(records, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    const status = e instanceof SdxApiError ? e.status : 502;
    return new Response((e as Error).message, {
      status,
      headers: { "content-type": "text/plain" },
    });
  }
}

export async function handleActivityApi(url: URL): Promise<Response> {
  const first = Math.min(
    Math.max(
      Number(url.searchParams.get("first") ?? "20") || 20,
      1,
    ),
    100,
  );
  const skip = Math.max(
    Number(url.searchParams.get("skip") ?? "0") || 0,
    0,
  );
  const organization = url.searchParams.get("organization") ?? undefined;
  try {
    const records = await loadActivity(
      first,
      skip,
      organization,
    );
    return Response.json(records, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response((e as Error).message, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }
}
