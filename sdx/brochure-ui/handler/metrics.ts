import React from "react";
import { config } from "../lib/config.ts";
import { MetricsPage } from "../pages/MetricsPage.tsx";
import { MetricsQueryNotFoundError, runQuery } from "../lib/metrics.ts";
import { authEnabled } from "../lib/auth.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export async function handleMetrics(
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const path = url.pathname;
  if (authEnabled && !user) {
    const returnTo = encodeURIComponent(
      path + url.search,
    );
    return new Response(null, {
      status: 302,
      headers: {
        location: `/auth/login?returnTo=${returnTo}`,
      },
    });
  }
  try {
    const konglogData = await runQuery(
      "konglog_service_code",
      "24h",
    );
    return htmlResponse(
      React.createElement(MetricsPage, {
        konglogData,
        config,
        currentPath: "/metrics",
        user,
      }),
    );
  } catch (e) {
    return new Response(
      `Metrics service unavailable: ${(e as Error).message}`,
      {
        status: 502,
        headers: { "content-type": "text/plain" },
      },
    );
  }
}

export async function handleKongLogApi(): Promise<Response> {
  try {
    const data = await runQuery(
      "konglog_service_code",
      "24h",
    );
    return Response.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    const status = e instanceof MetricsQueryNotFoundError ? 404 : 502;
    return new Response((e as Error).message, {
      status,
      headers: { "content-type": "text/plain" },
    });
  }
}
