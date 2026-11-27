import {
  certificatePayload,
  certificatesWithoutRuntime,
  fetchSigningKeyset,
  planCertificateInstall,
} from "../lib/org-signing-keyset.ts";
import { registerOrgCertificate, requestOrgCsr } from "../lib/org-signing.ts";
import { orgKeysetsUrlForEnv } from "../lib/environments.ts";
import React from "react";
import { loadOrganizations } from "../data.ts";
import { config } from "../lib/config.ts";
import { RuntimesPage } from "../pages/RuntimesPage.tsx";
import { hasSameRequestOrigin } from "../lib/auth.ts";
import { SdxApiError } from "../lib/connections.ts";
import { listRuntimeGroups } from "../lib/runtime-groups.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, requireAuth } from "./http.ts";

export async function handleRuntimes(
  req: Request,
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  if (
    url.pathname === "/runtimes/signing" && !user &&
    req.headers.get("accept")?.includes("application/json")
  ) {
    return Response.json({
      error: "Your session has expired. Reload the page and sign in again.",
    }, { status: 401 });
  }
  const gate = requireAuth(req, user);
  if (gate) return gate;

  const isSigning = url.pathname === "/runtimes/signing";
  if (isSigning && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (isSigning && !hasSameRequestOrigin(req)) {
    const error =
      "Invalid request origin. Open the Member Console directly and try again.";
    return req.headers.get("accept")?.includes("application/json")
      ? Response.json({ error }, { status: 403 })
      : new Response(error, { status: 403 });
  }
  const form = isSigning ? await req.formData() : null;
  const orgName = String(form?.get("org") ?? url.searchParams.get("org") ?? "");
  const organizations = await loadOrganizations();
  const selectedOrg = organizations.find((o) => o.name === orgName) ?? null;

  let ownedGroups: Awaited<
    ReturnType<typeof listRuntimeGroups>
  > = [];
  let availableGroups: Awaited<
    ReturnType<typeof listRuntimeGroups>
  > = [];
  let error: string | null = null;
  if (selectedOrg) {
    try {
      [ownedGroups, availableGroups] = await Promise.all([
        listRuntimeGroups(selectedOrg.name, "owned", {
          accessToken: user!.accessToken,
        }),
        listRuntimeGroups(selectedOrg.name, "available", {
          accessToken: user!.accessToken,
        }),
      ]);
    } catch (e) {
      ownedGroups = [];
      availableGroups = [];
      error = e instanceof SdxApiError
        ? `Failed to load runtime groups (${e.status}): ${e.body}`
        : (e as Error).message;
    }
  }

  const keysetUrl = (environment: string) => {
    const base = orgKeysetsUrlForEnv(environment);
    if (!base || !selectedOrg) {
      throw new Error("Organization signing registry is not configured");
    }
    const member = selectedOrg.member;
    const id = `sdx.org.${member.memberClass}.${member.memberId}.${environment}`
      .toLowerCase();
    return `${base.replace(/\/$/, "")}/${
      encodeURIComponent(id)
    }/.well-known/jwks.json`;
  };
  let signingResult: {
    group: string;
    environment: string;
    csr?: string;
    message?: string;
    confirmation?: string;
    review?: string;
  } | undefined;
  if (isSigning) {
    try {
      const group = String(form!.get("group") ?? "");
      const environment = String(form!.get("environment") ?? "");
      if (
        !selectedOrg ||
        !availableGroups.some((g) =>
          g.name === group && g.environment === environment
        )
      ) throw new Error("Select an available runtime group");
      const operation = String(form!.get("operation"));
      const opts = { accessToken: user!.accessToken };
      signingResult = { group, environment };
      if (operation === "csr") {
        signingResult.csr = await requestOrgCsr(
          orgName,
          group,
          environment,
          opts,
        );
      } else if (
        operation === "review" || operation === "install" ||
        operation === "remove"
      ) {
        const certificate = String(form!.get("certificate") ?? "").trim();
        const caCerts = config.environments?.find((env) =>
          env.id === environment
        )?.signing_root_ca_pem?.trim() ?? "";
        const current = await fetchSigningKeyset(
          keysetUrl(environment),
          selectedOrg.member,
          environment,
        );
        if (operation === "remove") {
          if (form!.get("confirm") !== "on") {
            throw new Error(
              "Confirm removal for this runtime group and environment",
            );
          }
          if (
            !current.certificates.some((entry) =>
              entry.runtime === group.toLowerCase()
            )
          ) {
            throw new Error(
              "No certificate is registered for this runtime group",
            );
          }
          const retained = certificatesWithoutRuntime(current, group);
          if (retained.length && !caCerts) {
            throw new Error(
              `Signing root CA is not configured for ${environment}. Contact your administrator.`,
            );
          }
          await registerOrgCertificate(
            orgName,
            environment,
            retained.length ? certificatePayload(retained, caCerts) : [],
            caCerts,
            retained.length === 0,
            opts,
          );
          signingResult.message =
            "Organization signing removed for this runtime group and environment.";
        } else {
          if (!caCerts) {
            throw new Error(
              `Signing root CA is not configured for ${environment}. Contact your administrator.`,
            );
          }
          const plan = planCertificateInstall(
            current,
            selectedOrg.member,
            environment,
            group,
            certificate,
            caCerts,
          );
          if (operation === "review") {
            signingResult.confirmation = plan.confirmation;
            signingResult.review = plan.message;
          } else {
            if (
              form!.get("confirmed") !== "on" ||
              form!.get("confirmation") !== plan.confirmation
            ) {
              throw new Error(
                "The key set or certificate has changed. Review the installation again before confirming.",
              );
            }
            await registerOrgCertificate(
              orgName,
              environment,
              plan.certificatePem,
              caCerts,
              false,
              opts,
            );
            signingResult.message = "Registration succeeded.";
          }
        }
      } else throw new Error("Unknown signing operation");
    } catch (e) {
      error = (e as Error).message;
    }
  }
  if (isSigning && req.headers.get("accept")?.includes("application/json")) {
    return Response.json(error ? { error } : signingResult, {
      status: error ? 400 : 200,
    });
  }
  const signing: Record<string, boolean | null> = {};
  if (selectedOrg) {
    await Promise.all(
      [
        ...new Set(
          availableGroups.map((g) => g.environment).filter((e): e is string =>
            !!e
          ),
        ),
      ].map(async (environment) => {
        const groups = availableGroups.filter((g) =>
          g.environment === environment
        );
        try {
          const current = await fetchSigningKeyset(
            keysetUrl(environment),
            selectedOrg.member,
            environment,
          );
          for (const group of groups) {
            signing[`${group.name}:${environment}`] = current.certificates.some(
              (entry) => entry.runtime === group.name.toLowerCase(),
            );
          }
        } catch {
          for (const group of groups) {
            signing[`${group.name}:${environment}`] = null;
          }
        }
      }),
    );
  }

  return htmlResponse(
    React.createElement(RuntimesPage, {
      organizations,
      selectedOrg,
      ownedGroups,
      availableGroups,
      signing,
      signingResult,
      error,
      config,
      currentPath: "/runtimes",
      user: user!,
    }),
  );
}
