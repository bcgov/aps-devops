import React from "react";
import { loadServices, loadSubsystems } from "../data.ts";
import { config } from "../lib/config.ts";
import { TrafficPage } from "../pages/TrafficPage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export async function handleTraffic(
  user: SessionUser | null,
): Promise<Response> {
  const [subsystems, services] = await Promise.all([
    loadSubsystems(),
    loadServices(),
  ]);
  return htmlResponse(
    React.createElement(TrafficPage, {
      subsystems,
      services,
      logStreamUrl: "/log-stream",
      config,
      currentPath: "/traffic",
      user,
    }),
  );
}
