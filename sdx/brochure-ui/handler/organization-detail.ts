import React from "react";
import {
  countBy,
  getOrgKeysets,
  loadActivity,
  loadOrganizationDetail,
  loadOrganizations,
  loadPublicBodyDetails,
  loadServices,
  loadSubsystems,
  ORGANIZATION_ACTIVITY_PAGE_SIZE,
} from "../data.ts";
import { config } from "../lib/config.ts";
import type { ActivityRecord } from "../types.ts";
import { OrgDetailPage } from "../pages/OrgDetailPage.tsx";
import { type PublicBody, type PublicBodyType } from "../lib/public-bodies.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse, notFound } from "./http.ts";

export async function handleOrganizationDetail(
  url: URL,
  user: SessionUser | null,
): Promise<Response> {
  const path = url.pathname;
  const orgName = decodeURIComponent(
    path.slice("/organizations/".length),
  );
  const [organizations, subsystems, services] = await Promise.all([
    loadOrganizations(),
    loadSubsystems(),
    loadServices(),
  ]);
  const org = organizations.find(
    (o) => o.name === orgName,
  );
  if (!org) return notFound();
  const orgDetail = await loadOrganizationDetail(org);
  const orgSubsystems = subsystems.filter(
    (subsystem) => subsystem.organization.name === orgName,
  );
  const serviceCounts = countBy(
    services,
    (service) => service.subsystem.clientId,
  );

  let publicBody: PublicBody | null = null;
  let publicBodyType: PublicBodyType | null = null;
  let publicBodyError: string | null = null;
  if (org.publicBodyId) {
    try {
      const { body, type } = await loadPublicBodyDetails(org.publicBodyId);
      publicBody = body;
      publicBodyType = type;
    } catch (e) {
      publicBodyError = `Public body lookup failed: ${(e as Error).message}`;
    }
  }

  let activity: ActivityRecord[] = [];
  let activityError: string | null = null;
  try {
    activity = await loadActivity(
      ORGANIZATION_ACTIVITY_PAGE_SIZE,
      0,
      org.name,
    );
  } catch (e) {
    activityError = `Activity feed unavailable: ${(e as Error).message}`;
  }

  const orgKeys = await getOrgKeysets(
    org.member.memberClass,
    org.member.memberId,
  );

  return htmlResponse(
    React.createElement(OrgDetailPage, {
      org: orgDetail,
      subsystems: orgSubsystems,
      serviceCounts,
      publicBody,
      publicBodyType,
      publicBodyError,
      activity,
      activityPageSize: ORGANIZATION_ACTIVITY_PAGE_SIZE,
      activityError,
      orgKeys,
      config,
      currentPath: path,
      user,
    }),
  );
}
