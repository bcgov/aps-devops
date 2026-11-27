import { verifyOrganizationResponse } from "../lib/response-verification.ts";
import React from "react";
import { getJwks, loadOrganizations } from "../data.ts";
import { config } from "../lib/config.ts";
import { TrustPage } from "../pages/TrustPage.tsx";
import { hasSameRequestOrigin } from "../lib/auth.ts";
import { DEFAULT_ENV } from "../lib/environments.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

export async function handleVerifyResponse(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!hasSameRequestOrigin(req)) {
    return new Response("Invalid origin", { status: 403 });
  }
  try {
    const form = await req.formData();
    const organizations = await loadOrganizations();
    const org = organizations.find((entry) =>
      entry.name === String(form.get("org"))
    );
    const environment = String(form.get("environment") ?? "");
    const env = config.environments?.find((entry) => entry.id === environment);
    if (!org || !env) {
      throw new Error("Select an organization and configured environment");
    }
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const result = await verifyOrganizationResponse({
      environment,
      memberClass: org.member.memberClass,
      memberId: org.member.memberId,
      edgeToken: field("edgeToken"),
      entitySig: field("entitySig"),
    }, { jwksUrls: env.jwks_urls ?? [], registryBase: env.org_keysets_url });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({
      verified: false,
      checks: [{
        label: "Verification",
        passed: false,
        message: (error as Error).message,
      }],
    }, { headers: { "cache-control": "no-store" } });
  }
}

export async function handleTrust(user: SessionUser | null): Promise<Response> {
  const allSources = await getJwks();
  // The environment switcher only renders for logged-in users. Anonymous
  // visitors can't switch, so show only the default environment's sources
  // (plus any that are environment-agnostic).
  const sources = user ? allSources : allSources.filter(
    (s) => !s.environment || s.environment === DEFAULT_ENV,
  );
  return htmlResponse(
    React.createElement(TrustPage, {
      sources,
      config,
      currentPath: "/trust",
      user,
    }),
  );
}
