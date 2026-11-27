import React from "react";
import { OnboardingInvitePage } from "../pages/OnboardingInvitePage.tsx";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export function handleOnboardingInvite(
  url: URL,
  user: SessionUser | null,
): Response {
  const path = url.pathname;
  const integrationId = url.searchParams.get("integrationId")?.trim() ?? "";
  return htmlResponse(
    React.createElement(OnboardingInvitePage, {
      integrationId,
      currentPath: `${path}${url.search}`,
      user,
    }),
  );
}
