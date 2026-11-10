import { Layout } from "../components/Layout.tsx";
import { Breadcrumb, type Crumb } from "../components/custom/Breadcrumb.tsx";
import { SubsystemCard } from "../components/custom/SubsystemCard.tsx";
import { ActivityFeed } from "../components/custom/ActivityFeed.tsx";
import { Contacts } from "../components/custom/Contacts.tsx";
import {
  type EnvKeyset,
  TrustKeysets,
} from "../components/custom/TrustKeysets.tsx";
import type {
  ActivityRecord,
  Organization,
  Subsystem,
  SiteConfig,
} from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";
import type {
  PublicBody,
  PublicBodyType,
} from "../lib/public-bodies.ts";

const MEMBER_CLASS_LABELS: Record<string, string> = {
  MIN: "Ministry",
  DIV: "Division",
  USR: "Individual",
  PUB: "Public Body",
};

const MEMBER_CLASS_COLORS: Record<string, string> = {
  MIN: "bg-support-info-bg text-support-info-border",
  DIV: "bg-support-success-bg text-support-success-border",
  USR: "bg-surface-muted text-ink-secondary",
  PUB: "bg-surface-blue-tint text-bc-blue",
};

interface OrgDetailPageProps {
  org: Organization;
  subsystems: Subsystem[];
  serviceCounts: Record<string, number>;
  publicBody?: PublicBody | null;
  publicBodyType?: PublicBodyType | null;
  publicBodyError?: string | null;
  activity?: ActivityRecord[];
  activityPageSize?: number;
  activityError?: string | null;
  orgKeys?: EnvKeyset[];
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

function PublicBodyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-border px-4 py-3">
      <dt className="text-xs text-ink-secondary mb-1">{label}</dt>
      <dd
        className={`font-semibold text-ink break-all ${mono ? "font-mono text-sm" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function OrgDetailPage({ org, subsystems, serviceCounts, publicBody, publicBodyType, publicBodyError, activity = [], activityPageSize = 20, activityError, orgKeys = [], config: _config, currentPath, user }: OrgDetailPageProps) {
  const classLabel = MEMBER_CLASS_LABELS[org.member.memberClass] ?? org.member.memberClass;
  const classColor = MEMBER_CLASS_COLORS[org.member.memberClass] ?? "bg-surface-muted text-ink-secondary";

  const businessId = publicBody?.businessIdValue
    ? `${publicBody.businessIdValue}${
        publicBody.businessIdSource ? ` (${publicBody.businessIdSource})` : ""
      }`
    : null;
  const publicBodyName = publicBody
    ? publicBody.acronym
      ? `${publicBody.name} (${publicBody.acronym})`
      : publicBody.name
    : null;
  const publicBodyTypeLabel = publicBodyType
    ? publicBodyType.shortName
      ? `${publicBodyType.name} · ${publicBodyType.shortName}`
      : publicBodyType.name
    : null;
  const contacts = org.access ?? [];
  const breadcrumbItems: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Organizations", href: "/organizations" },
    { label: org.title },
  ];

  return (
    <Layout title={org.title} currentPath={currentPath} user={user}>
      <Breadcrumb items={breadcrumbItems} />

      {/* Org header */}
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${classColor}`}>
              {classLabel}
            </span>
            <span className="text-xs text-ink-invert-secondary font-mono self-center">{org.member.memberId}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{org.title}</h1>
          {org.description && (
            <p className="text-ink-invert-secondary max-w-2xl">{org.description}</p>
          )}
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      {/* About section */}
      <div className="bg-surface-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">
            Organization Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">SDX Member Class</dt>
              <dd className="font-mono font-semibold text-ink">{org.member.memberClass}</dd>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">SDX Member ID</dt>
              <dd className="font-mono font-semibold text-ink">{org.member.memberId}</dd>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">Subsystems</dt>
              <dd className="font-semibold text-ink">{subsystems.length}</dd>
            </div>

            {/* Public body details (when the organization maps to one) */}
            {publicBodyName && (
              <PublicBodyField label="Public body" value={publicBodyName} />
            )}
            {publicBodyTypeLabel && (
              <PublicBodyField label="Public body type" value={publicBodyTypeLabel} />
            )}
            {businessId && (
              <PublicBodyField label="Business ID" value={businessId} />
            )}
            {publicBody?.sector && (
              <PublicBodyField label="Sector" value={publicBody.sector} />
            )}
            {publicBody?.publicBodyEffectiveDate && (
              <PublicBodyField
                label="Effective date"
                value={publicBody.publicBodyEffectiveDate}
              />
            )}
            {publicBody?.publicBodyRetiredDate && (
              <PublicBodyField
                label="Retired date"
                value={publicBody.publicBodyRetiredDate}
              />
            )}
            {org.publicBodyId && (
              <PublicBodyField
                label="Public body ID"
                value={org.publicBodyId}
                mono
              />
            )}
          </dl>

          {org.publicBodyId && publicBodyError && (
            <div className="mt-3 rounded-md border-l-4 border-support-warning-border bg-support-warning-bg text-ink px-3 py-2 text-sm">
              {publicBodyError}
            </div>
          )}
          {org.publicBodyId && !publicBody && !publicBodyError && (
            <p className="text-sm text-ink-secondary mt-3">
              No public body record found for{" "}
              <span className="font-mono">{org.publicBodyId}</span>.
            </p>
          )}
        </div>
      </div>

      {/* Trust keysets — present only when the org publishes keys */}
      <TrustKeysets
        keysets={orgKeys}
        description="Public keys published for this organization member in the SDX JWKS registry, by environment."
      />

      {/* Contacts section */}
      <Contacts
        contacts={contacts}
        description="People responsible for this organization and the roles they hold"
      />

      {/* Recent Activity section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-2xl font-bold text-bc-blue mb-6">
          Recent Activity
        </h2>
        {activityError && (
          <div className="mb-4 rounded-md border-l-4 border-support-danger-border bg-support-danger-bg text-ink px-4 py-3 text-sm">
            {activityError}
          </div>
        )}
        <ActivityFeed
          activity={activity}
          pageSize={activityPageSize}
          apiPath={`/api/activity?organization=${encodeURIComponent(org.name)}`}
        />
      </div>

      {/* Subsystems section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-2xl font-bold text-bc-blue mb-6">
          Subsystems
          <span className="ml-2 text-base font-normal text-ink-secondary">({subsystems.length})</span>
        </h2>

        {subsystems.length === 0 ? (
          <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
            <p className="text-ink-secondary">No subsystems registered for this organization.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subsystems.map((sub) => (
              <SubsystemCard
                key={sub.clientId}
                subsystem={sub}
                href={`/subsystems/${sub.clientId}`}
                serviceCount={serviceCounts[sub.clientId] ?? 0}
                showOrganization={false}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
