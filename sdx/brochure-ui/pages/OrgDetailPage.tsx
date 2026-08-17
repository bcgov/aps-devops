import { Layout } from "../components/Layout.tsx";
import { SubsystemCard } from "../components/SubsystemCard.tsx";
import { ActivityFeed } from "../components/ActivityFeed.tsx";
import { Contacts } from "../components/Contacts.tsx";
import {
  type EnvKeyset,
  TrustKeysets,
} from "../components/TrustKeysets.tsx";
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
  MIN: "bg-blue-100 text-blue-800",
  DIV: "bg-green-100 text-green-800",
  USR: "bg-gray-100 text-gray-700",
  PUB: "bg-purple-100 text-purple-800",
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
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <dt className="text-xs text-gray-500 mb-1">{label}</dt>
      <dd
        className={`font-semibold text-gray-800 break-all ${mono ? "font-mono text-sm" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function OrgDetailPage({ org, subsystems, serviceCounts, publicBody, publicBodyType, publicBodyError, activity = [], activityPageSize = 20, activityError, orgKeys = [], config: _config, currentPath, user }: OrgDetailPageProps) {
  const classLabel = MEMBER_CLASS_LABELS[org.member.memberClass] ?? org.member.memberClass;
  const classColor = MEMBER_CLASS_COLORS[org.member.memberClass] ?? "bg-gray-100 text-gray-700";

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

  return (
    <Layout title={org.title} currentPath={currentPath} user={user}>
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-sm text-gray-500">
          <a href="/" className="hover:text-[#003366] hover:underline">Home</a>
          <span className="mx-2">›</span>
          <a href="/organizations" className="hover:text-[#003366] hover:underline">Organizations</a>
          <span className="mx-2">›</span>
          <span className="text-gray-800 font-medium">{org.title}</span>
        </div>
      </div>

      {/* Org header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${classColor}`}>
              {classLabel}
            </span>
            <span className="text-xs text-blue-300 font-mono self-center">{org.member.memberId}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{org.title}</h1>
          {org.description && (
            <p className="text-blue-200 max-w-2xl">{org.description}</p>
          )}
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      {/* About section */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Organization Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <dt className="text-xs text-gray-500 mb-1">SDX Member Class</dt>
              <dd className="font-mono font-semibold text-gray-800">{org.member.memberClass}</dd>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <dt className="text-xs text-gray-500 mb-1">SDX Member ID</dt>
              <dd className="font-mono font-semibold text-gray-800">{org.member.memberId}</dd>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <dt className="text-xs text-gray-500 mb-1">Subsystems</dt>
              <dd className="font-semibold text-gray-800">{subsystems.length}</dd>
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
            <p className="text-sm text-amber-700 mt-3">{publicBodyError}</p>
          )}
          {org.publicBodyId && !publicBody && !publicBodyError && (
            <p className="text-sm text-gray-500 mt-3">
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
        <h2 className="text-2xl font-bold text-[#003366] mb-6">
          Recent Activity
        </h2>
        {activityError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
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
        <h2 className="text-2xl font-bold text-[#003366] mb-6">
          Subsystems
          <span className="ml-2 text-base font-normal text-gray-500">({subsystems.length})</span>
        </h2>

        {subsystems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No subsystems registered for this organization.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subsystems.map((sub) => (
              <SubsystemCard
                key={sub.clientId}
                subsystem={sub}
                href={`/subsystems/${sub.clientId}`}
                serviceCount={serviceCounts[sub.clientId] ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
