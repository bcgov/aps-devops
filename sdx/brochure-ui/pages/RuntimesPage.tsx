import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import { OrgPicker } from "../components/custom/OrgPicker.tsx";
import { EnvFilter } from "../components/custom/EnvFilter.tsx";
import { envAttr } from "../lib/environments.ts";
import type { Organization, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";
import type { RuntimeGroup } from "../lib/runtime-groups.ts";

// Embed the dialog controller with the SSR page so markup and behavior always
// update together, without a separately cached JavaScript asset.
const signingScript = await Deno.readTextFile(
  new URL("../public/signing.js", import.meta.url),
);

interface RuntimesPageProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  ownedGroups: RuntimeGroup[];
  availableGroups: RuntimeGroup[];
  error: string | null;
  signing?: Record<string, boolean | null>;
  signingResult?: {
    group: string;
    environment: string;
    csr?: string;
    message?: string;
  };
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
}

function RuntimeGroupCard({
  group,
  org,
  signing,
  signingResult,
}: {
  org?: string;
  signing?: Record<string, boolean | null>;
  signingResult?: RuntimesPageProps["signingResult"];
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
      {org && group.environment && (
        <div className="border-t pt-3 text-sm space-y-2">
          <p>
            Organization signing:{" "}
            <strong>
              {signing?.[`${group.name}:${group.environment}`] === true
                ? "Configured"
                : signing?.[`${group.name}:${group.environment}`] === false
                ? "Not configured"
                : "Status unavailable"}
            </strong>
          </p>
          <p className="text-xs text-gray-500">
            Each edge runtime has its own certificate in the organization’s{" "}
            {group.environment} signing key set.
          </p>
          <button
            type="button"
            data-open-signing
            className="rounded bg-[#003366] text-white px-3 py-2"
          >
            {signing?.[`${group.name}:${group.environment}`]
              ? "Renew"
              : "Setup"}
          </button>
          <dialog
            data-signing-dialog
            aria-label="Setup Signing Key"
            className="rounded-lg p-0 w-full max-w-2xl backdrop:bg-black/40"
          >
            <div className="p-6 space-y-4">
              <header className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-[#003366]">
                  Setup Signing Key
                </h2>
                <button
                  type="button"
                  data-close-signing
                  aria-label="Close dialog"
                  className="text-gray-600 px-2 py-1"
                >
                  ✕
                </button>
              </header>
              <p className="text-sm text-gray-600">
                {group.name} · {group.environment}
              </p>
              <div
                role="tablist"
                aria-label="Signing setup steps"
                className="flex border-b gap-4"
              >
                <button
                  type="button"
                  role="tab"
                  id={`csr-tab-${group.name}-${group.environment}`}
                  aria-controls={`csr-panel-${group.name}-${group.environment}`}
                  aria-selected="true"
                  data-signing-tab="csr"
                  className="px-3 py-2 border-b-2 border-[#003366] font-semibold"
                >
                  Create a CSR
                </button>
                <button
                  type="button"
                  role="tab"
                  id={`install-tab-${group.name}-${group.environment}`}
                  aria-controls={`install-panel-${group.name}-${group.environment}`}
                  aria-selected="false"
                  tabIndex={-1}
                  data-signing-tab="install"
                  className="px-3 py-2 border-b-2 border-transparent"
                >
                  Install Certificate
                </button>
              </div>
              <section
                role="tabpanel"
                id={`csr-panel-${group.name}-${group.environment}`}
                aria-labelledby={`csr-tab-${group.name}-${group.environment}`}
                data-signing-panel="csr"
                className="space-y-3"
              >
                <p className="text-sm text-gray-600">
                  Create a CSR and send it to the APS team for approval and
                  signing. When you receive the signed certificate, install it
                  in the next tab.
                </p>
                <form
                  method="post"
                  action="/runtimes/signing"
                  data-signing-form
                >
                  <input type="hidden" name="org" value={org} />
                  <input type="hidden" name="group" value={group.name} />
                  <input
                    type="hidden"
                    name="environment"
                    value={group.environment}
                  />
                  <input type="hidden" name="operation" value="csr" />
                  <button className="rounded bg-[#003366] text-white px-3 py-2">
                    Create a CSR
                  </button>
                </form>
                <div data-csr-result hidden>
                  <label className="block text-sm">
                    Certificate signing request<textarea
                      data-csr
                      readOnly
                      className="block w-full border rounded p-3 font-mono text-xs mt-2"
                      rows={10}
                    />
                  </label>
                  <button
                    type="button"
                    data-copy-csr
                    className="mt-2 text-blue-800 underline"
                  >
                    Copy CSR to clipboard
                  </button>
                </div>
              </section>
              <section
                role="tabpanel"
                id={`install-panel-${group.name}-${group.environment}`}
                aria-labelledby={`install-tab-${group.name}-${group.environment}`}
                data-signing-panel="install"
                hidden
                className="space-y-3"
              >
                <p className="text-sm text-gray-600">
                  Paste the signed certificate, including any intermediate CAs,
                  in PEM format. The root CA is supplied automatically for this
                  environment.
                </p>
                <form
                  method="post"
                  action="/runtimes/signing"
                  data-signing-form
                  className="space-y-3"
                >
                  <input type="hidden" name="org" value={org} />
                  <input type="hidden" name="group" value={group.name} />
                  <input
                    type="hidden"
                    name="environment"
                    value={group.environment}
                  />
                  <input type="hidden" name="operation" value="review" />
                  <label className="block text-sm">
                    Signed certificate (PEM)<textarea
                      name="certificate"
                      required
                      className="block w-full border rounded p-3 font-mono text-xs mt-2"
                      rows={10}
                      placeholder="-----BEGIN CERTIFICATE-----"
                    />
                  </label>
                  <button
                    data-review-install
                    className="rounded bg-[#003366] text-white px-3 py-2"
                  >
                    Install
                  </button>
                  <div
                    data-install-review
                    hidden
                    className="rounded border border-blue-200 bg-blue-50 p-3 space-y-3"
                  >
                    <p data-install-review-message className="text-sm" />
                    <input type="hidden" name="confirmation" />
                    <label className="block text-sm">
                      <input type="checkbox" name="confirmed" />{" "}
                      I confirm this change to the environment signing key set.
                    </label>
                    <button className="rounded bg-[#003366] text-white px-3 py-2">
                      Confirm installation
                    </button>
                  </div>
                </form>
              </section>
              <p
                data-signing-status
                role="status"
                aria-live="polite"
                className="text-sm"
              />
              <footer className="flex justify-end border-t pt-3">
                <button
                  type="button"
                  data-close-signing
                  className="rounded border px-4 py-2"
                >
                  Close
                </button>
              </footer>
            </div>
          </dialog>
          {signing?.[`${group.name}:${group.environment}`] === true && (
            <form
              method="post"
              action="/runtimes/signing"
              className="space-y-2"
            >
              <input type="hidden" name="org" value={org} />
              <input type="hidden" name="group" value={group.name} />
              <input
                type="hidden"
                name="environment"
                value={group.environment}
              />
              <label className="block text-xs">
                <input type="checkbox" name="confirm" required />{" "}
                Remove organization signing for this runtime group and
                environment
              </label>
              <button
                className="text-red-800 underline"
                name="operation"
                value="remove"
              >
                Remove
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function GroupSection({
  title,
  description,
  groups,
  emptyMessage,
  accent,
  org,
  signing,
  signingResult,
}: {
  org?: string;
  signing?: Record<string, boolean | null>;
  signingResult?: RuntimesPageProps["signingResult"];
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
            <RuntimeGroupCard
              key={`${g.name}:${g.environment}`}
              group={g}
              org={org}
              signing={signing}
              signingResult={signingResult}
            />
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
  signing,
  signingResult,
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
          { label: "Runtime Groups" },
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
                org={selectedOrg.name}
                signing={signing}
                signingResult={signingResult}
              />
            </div>
          </>
        )}
      </div>
      <script dangerouslySetInnerHTML={{ __html: signingScript }} />
    </Layout>
  );
}
