import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import { OrgPicker } from "../components/custom/OrgPicker.tsx";
import { EnvFilter } from "../components/custom/EnvFilter.tsx";
import { CONSOLE_PAGES } from "../components/custom/ConsoleNav.tsx";
import { envAttr } from "../lib/environments.ts";
import type { Organization, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";
import type { RuntimeGroup } from "../lib/runtime-groups.ts";

interface RuntimesPageProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  ownedGroups: RuntimeGroup[];
  availableGroups: RuntimeGroup[];
  error: string | null;
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
}

function RuntimeGroupCard({
  group,
}: {
  group: RuntimeGroup;
}) {
  const hosted = Array.isArray(group.hostedOrganizations)
    ? group.hostedOrganizations
    : [];
  return (
    <article
      data-env-item
      data-env={envAttr(group.environment)}
      className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-bc-blue font-mono text-sm">
          {group.name}{" "}
          {group.environment && `(${group.environment})`}
        </h3>
      </header>
      <dl className="grid grid-cols-1 sm:grid-cols-[140px,1fr] gap-x-3 gap-y-1 text-xs">
        {group.environment && (
          <>
            <dt className="text-ink-secondary">Environment</dt>
            <dd className="font-mono text-ink break-all">
              {group.environment}
            </dd>
          </>
        )}
        {group.host && (
          <>
            <dt className="text-ink-secondary">Host</dt>
            <dd className="font-mono text-ink break-all">
              {group.host}
            </dd>
          </>
        )}
        {group.sdxEndpoint && (
          <>
            <dt className="text-ink-secondary">SDX endpoint</dt>
            <dd className="font-mono text-ink break-all">
              {group.sdxEndpoint}
            </dd>
          </>
        )}
        {group.consumerEndpoint && (
          <>
            <dt className="text-ink-secondary">
              Consumer endpoint
            </dt>
            <dd className="font-mono text-ink break-all">
              {group.consumerEndpoint}
            </dd>
          </>
        )}
        {hosted.length > 0 && (
          <>
            <dt className="text-ink-secondary">
              Hosted organizations
            </dt>
            <dd className="text-ink">
              <ul className="flex flex-wrap gap-1">
                {hosted.map((h) => (
                  <li
                    key={h}
                    className="inline-block bg-surface-muted text-ink-secondary rounded px-2 py-0.5 font-mono text-xs"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}

function GroupSection({
  title,
  description,
  groups,
  emptyMessage,
  accent,
}: {
  title: string;
  description: string;
  groups: RuntimeGroup[];
  emptyMessage: string;
  accent: "blue" | "gold";
}) {
  const sorted = [...groups].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const accentClass =
    accent === "gold"
      ? "border-l-bc-gold"
      : "border-l-bc-blue";
  const isEmpty = sorted.length === 0;
  return (
    <section
      data-env-group
      className={`bg-white border border-border border-l-4 ${accentClass} rounded-lg overflow-hidden`}
    >
      <header className="bg-surface-muted border-b border-border px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-bc-blue">
            {title}
          </h2>
          <p className="text-xs text-ink-secondary">
            {description}
          </p>
        </div>
        <span
          className="text-xs text-ink-secondary"
          data-env-count
          data-env-noun="group"
        >
          {sorted.length} group
          {sorted.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="p-4">
        <div
          data-env-items
          style={isEmpty ? { display: "none" } : undefined}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {sorted.map((g) => (
            <RuntimeGroupCard key={g.name} group={g} />
          ))}
        </div>
        <p
          data-env-empty
          style={isEmpty ? undefined : { display: "none" }}
          className="text-sm text-ink-secondary italic"
        >
          {emptyMessage}
        </p>
      </div>
    </section>
  );
}

export function RuntimesPage({
  organizations,
  selectedOrg,
  ownedGroups,
  availableGroups,
  error,
  config: _config,
  currentPath,
  user,
}: RuntimesPageProps) {
  return (
    <Layout
      title="Runtime Groups"
      currentPath={currentPath}
      user={user}
    >
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Member Console", href: "/console" },
          {
            label: "Runtime Groups",
            menu: CONSOLE_PAGES.filter((p) => p.href !== "/runtimes"),
          },
        ]}
      />

      {/* Header */}
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-4xl font-bold mb-2">
            Runtime Groups
          </h1>
          <p className="text-ink-invert-secondary max-w-2xl">
            Runtime groups owned by, and available to, an
            organization member.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      {/* Picker */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <OrgPicker
            organizations={organizations}
            selectedOrg={selectedOrg}
            action="/runtimes"
            submitLabel="Load runtime groups"
            autoSubmit
          />
          <EnvFilter label="Environment" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded border border-support-danger-border bg-support-danger-bg text-danger px-4 py-3 text-sm"
          >
            {error}
          </div>
        )}

        {!selectedOrg ? (
          <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
            <p className="text-ink-secondary">
              Select an organization member above to view
              its runtime groups.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-bc-blue">
                {selectedOrg.title}
              </h2>
              <p className="text-xs text-ink-secondary font-mono">
                {selectedOrg.member.memberClass}/
                {selectedOrg.member.memberId}
              </p>
            </div>

            <div className="space-y-6">
              <GroupSection
                title="Owned runtime groups"
                description="Runtime groups this organization operates."
                groups={ownedGroups}
                emptyMessage="This organization does not own any runtime groups."
                accent="blue"
              />
              <GroupSection
                title="Available runtime groups"
                description="Runtime groups hosted by other organizations that this organization may consume from."
                groups={availableGroups}
                emptyMessage="No additional runtime groups are available to this organization."
                accent="gold"
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
