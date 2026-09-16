import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import { Markdown } from "../components/custom/Markdown.tsx";
import { CopyButton } from "../components/custom/CopyButton.tsx";
import { Contacts } from "../components/custom/Contacts.tsx";
import {
  type EnvKeyset,
  TrustKeysets,
} from "../components/custom/TrustKeysets.tsx";
import type {
  Service,
  ServiceOperation,
  SiteConfig,
  Subsystem,
} from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

const MEMBER_CLASS_LABELS: Record<string, string> = {
  MIN: "Ministry",
  DIV: "Division",
  USR: "Individual",
  PUB: "Public Body",
};

// Categorical (non-semantic) badge colors — each member class is just a
// distinct data label, not a status, so these keep their own hues rather
// than mapping onto the design system's semantic support/* tokens.
const MEMBER_CLASS_COLORS: Record<string, string> = {
  MIN: "bg-blue-100 text-blue-800",
  DIV: "bg-green-100 text-green-800",
  USR: "bg-surface-muted text-ink-secondary",
  PUB: "bg-purple-100 text-purple-800",
};

// HTTP methods are categorical data labels too — kept as distinct hues,
// standardized to the shared badge shape (see method span below).
const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-50 text-blue-700",
  POST: "bg-green-50 text-green-700",
  PUT: "bg-yellow-50 text-yellow-700",
  PATCH: "bg-orange-50 text-orange-700",
  DELETE: "bg-red-50 text-red-700",
};

type SpecKind = "openapi" | "asyncapi" | "unknown";

function parseSpec(
  specVersion: string | null | undefined,
): {
  kind: SpecKind;
  version: string | null;
} {
  if (!specVersion)
    return { kind: "unknown", version: null };
  const [rawKind, ...rest] = specVersion.split("=");
  const version = rest.join("=") || null;
  const kind = rawKind.toLowerCase();
  if (kind === "openapi" || kind === "asyncapi") {
    return { kind, version };
  }
  return { kind: "unknown", version };
}

function tagFromPath(path: string): string {
  const first = path.split("/").filter(Boolean)[0];
  if (!first) return "General";
  return first
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupOperationsByTag(
  ops: ServiceOperation[],
): [string, ServiceOperation[]][] {
  const map = new Map<string, ServiceOperation[]>();
  for (const op of ops) {
    const tag = op.tags?.[0] ?? tagFromPath(op.path);
    (map.get(tag) ?? map.set(tag, []).get(tag)!).push(op);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([tag, ops]) =>
        [
          tag,
          ops
            .slice()
            .sort((a, b) => a.path.localeCompare(b.path)),
        ] as [string, ServiceOperation[]],
    );
}

// AsyncAPI: `method` on each operation is the service's action
// (SEND = service publishes, RECEIVE = service consumes). From the
// integrator's point of view, that flips: the service's SEND is something
// you subscribe to, and the service's RECEIVE is something you publish.
function partitionAsyncOps(ops: ServiceOperation[]): {
  subscribe: ServiceOperation[];
  publish: ServiceOperation[];
  other: ServiceOperation[];
} {
  const subscribe: ServiceOperation[] = [];
  const publish: ServiceOperation[] = [];
  const other: ServiceOperation[] = [];
  for (const op of ops) {
    const m = op.method.toUpperCase();
    if (m === "SEND") subscribe.push(op);
    else if (m === "RECEIVE") publish.push(op);
    else other.push(op);
  }
  const sortByPath = (
    a: ServiceOperation,
    b: ServiceOperation,
  ) => a.path.localeCompare(b.path);
  subscribe.sort(sortByPath);
  publish.sort(sortByPath);
  other.sort(sortByPath);
  return { subscribe, publish, other };
}

function SpecBadge({
  kind,
  version,
}: {
  kind: SpecKind;
  version: string | null;
}) {
  if (kind === "unknown") return null;
  const label = kind === "openapi" ? "OpenAPI" : "AsyncAPI";
  const color =
    kind === "openapi"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-violet-50 text-violet-700";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-semibold ${color}`}
      title={`${label} specification${version ? ` ${version}` : ""}`}
    >
      {label}
      {version ? ` ${version}` : ""}
    </span>
  );
}

function AsyncOperationRow({
  op,
  direction,
}: {
  op: ServiceOperation;
  direction: "subscribe" | "publish";
}) {
  const badge =
    direction === "subscribe"
      ? {
          text: "SUBSCRIBE",
          color: "bg-cyan-50 text-cyan-700",
        }
      : {
          text: "PUBLISH",
          color: "bg-fuchsia-50 text-fuchsia-700",
        };
  return (
    <div
      className="px-5 py-3 grid gap-x-3 items-baseline"
      style={{ gridTemplateColumns: "5.5rem 1fr auto" }}
    >
      <span
        className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-mono font-bold uppercase ${badge.color}`}
      >
        {badge.text}
      </span>
      <div className="min-w-0">
        <code className="text-sm font-mono text-ink break-all">
          {op.path}
        </code>
        {op.summary && (
          <div className="text-sm text-ink-secondary mt-0.5">
            {op.summary}
          </div>
        )}
        {op.scopes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {op.scopes.map((scope) => (
              <span
                key={scope.name}
                title={scope.description}
                className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-mono"
              >
                {scope.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {op.operationId && (
        <span className="text-xs text-ink-secondary font-mono self-start">
          {op.operationId}
        </span>
      )}
    </div>
  );
}

interface SubsystemDetailPageProps {
  subsystem: Subsystem;
  services: Service[];
  subsystemKeys: EnvKeyset[];
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

export function SubsystemDetailPage({
  subsystem,
  services,
  subsystemKeys,
  config: _config,
  currentPath,
  user,
}: SubsystemDetailPageProps) {
  const classLabel =
    MEMBER_CLASS_LABELS[subsystem.member.memberClass] ??
    subsystem.member.memberClass;
  const classColor =
    MEMBER_CLASS_COLORS[subsystem.member.memberClass] ??
    "bg-surface-muted text-ink-secondary";

  const totalOperations = services.reduce(
    (n, s) => n + s.operations.length,
    0,
  );

  const contacts = subsystem.access ?? [];

  return (
    <Layout
      title={subsystem.name}
      currentPath={currentPath}
      user={user}
    >
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Subsystems", href: "/subsystems" },
          { label: subsystem.clientId },
        ]}
      />

      {/* Subsystem header */}
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-ink-invert-secondary">
                <a
                  href={`/organizations/${subsystem.organization.name}`}
                  className="hover:text-ink-invert hover:underline"
                >
                  {subsystem.organization.title}
                </a>
                <span aria-hidden="true">›</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classColor}`}
                >
                  {classLabel}
                </span>
              </div>
              <h1 className="text-3xl font-bold mb-3">
                {subsystem.name}
              </h1>
              {subsystem.description && (
                <p className="text-ink-invert-secondary max-w-2xl">
                  {subsystem.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      {/* Identifier + metadata */}
      <div className="bg-surface-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <h2 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">
            Identifier in Secure Data Exchange
          </h2>
          <div className="flex items-center gap-2 mb-5">
            <code className="font-mono text-lg font-semibold text-bc-blue bg-white border border-border rounded-lg px-4 py-3">
              {subsystem.clientId}
            </code>
            <CopyButton value={subsystem.clientId} />
          </div>
        </div>
      </div>

      {/* Trust keysets — present only when the subsystem publishes keys */}
      <TrustKeysets
        keysets={subsystemKeys}
        description="Public keys published for this subsystem in the SDX JWKS registry, by environment."
      />

      {/* Contacts section */}
      <Contacts
        contacts={contacts}
        description="People responsible for this subsystem and the roles they hold"
      />

      {/* Services section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-2xl font-bold text-bc-blue mb-1">
          Services
          <span className="ml-2 text-base font-normal text-ink-secondary">
            ({services.length} service
            {services.length !== 1 ? "s" : ""},{" "}
            {totalOperations} operation
            {totalOperations !== 1 ? "s" : ""})
          </span>
        </h2>
        <p className="text-ink-secondary text-sm mb-6">
          API services exposed by this subsystem
        </p>

        {services.length === 0 ? (
          <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
            <p className="text-ink-secondary font-medium">
              No services registered for this subsystem.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {services.map((service) => {
              const spec = parseSpec(service.specVersion);
              const isAsync = spec.kind === "asyncapi";
              const asyncOps = isAsync
                ? partitionAsyncOps(service.operations)
                : null;
              const taggedOps = isAsync
                ? null
                : groupOperationsByTag(service.operations);
              return (
                <div
                  key={service.name}
                  className="bg-white rounded-lg border border-border shadow-sm overflow-hidden"
                >
                  {/* Service header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-border bg-surface-muted">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-bc-blue text-lg">
                          {service.title}
                        </h3>
                        <span className="text-xs bg-bc-blue text-white px-2 py-0.5 rounded font-mono">
                          v{service.version}
                        </span>
                        <SpecBadge
                          kind={spec.kind}
                          version={spec.version}
                        />
                      </div>
                      {(service.summary ??
                        service.description) && (
                        <Markdown
                          content={
                            service.summary ??
                            service.description ??
                            ""
                          }
                          className="text-ink-secondary text-sm mt-1"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 self-start shrink-0">
                      <span className="text-xs text-ink-secondary font-mono">
                        {service.name}
                      </span>
                      <CopyButton value={service.name} />
                    </div>
                  </div>

                  {/* Operations */}
                  {service.operations.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-ink-secondary italic">
                      No operations defined
                    </div>
                  ) : isAsync && asyncOps ? (
                    <div>
                      {asyncOps.subscribe.length > 0 && (
                        <div>
                          <h4 className="px-5 py-2 bg-cyan-50/60 border-b border-t border-cyan-100 flex items-baseline gap-2 text-xs font-semibold text-cyan-800 uppercase tracking-wide">
                            Subscribe
                            <span className="text-xs font-normal normal-case text-cyan-700/80">
                              channels this service
                              publishes — consumers receive
                              these messages
                            </span>
                            <span className="ml-auto text-xs font-normal normal-case text-ink-secondary">
                              {asyncOps.subscribe.length}{" "}
                              channel
                              {asyncOps.subscribe.length !==
                              1
                                ? "s"
                                : ""}
                            </span>
                          </h4>
                          <div className="divide-y divide-border">
                            {asyncOps.subscribe.map(
                              (op) => (
                                <AsyncOperationRow
                                  key={`sub-${op.operationId ?? ""}-${op.path}`}
                                  op={op}
                                  direction="subscribe"
                                />
                              ),
                            )}
                          </div>
                        </div>
                      )}
                      {asyncOps.publish.length > 0 && (
                        <div>
                          <h4 className="px-5 py-2 bg-fuchsia-50/60 border-b border-t border-fuchsia-100 flex items-baseline gap-2 text-xs font-semibold text-fuchsia-800 uppercase tracking-wide">
                            Publish
                            <span className="text-xs font-normal normal-case text-fuchsia-700/80">
                              channels this service consumes
                              — producers send messages here
                            </span>
                            <span className="ml-auto text-xs font-normal normal-case text-ink-secondary">
                              {asyncOps.publish.length}{" "}
                              channel
                              {asyncOps.publish.length !== 1
                                ? "s"
                                : ""}
                            </span>
                          </h4>
                          <div className="divide-y divide-border">
                            {asyncOps.publish.map((op) => (
                              <AsyncOperationRow
                                key={`pub-${op.operationId ?? ""}-${op.path}`}
                                op={op}
                                direction="publish"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {asyncOps.other.length > 0 && (
                        <div className="divide-y divide-border">
                          {asyncOps.other.map((op) => (
                            <div
                              key={`other-${op.operationId ?? ""}-${op.path}`}
                              className="px-5 py-3 text-sm text-ink-secondary font-mono"
                            >
                              {op.method} {op.path}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {taggedOps!.map(([tag, ops]) => (
                        <div key={tag}>
                          {/* Tag header — only shown when there are multiple tags */}
                          {taggedOps!.length > 1 && (
                            <h4 className="px-5 py-2 bg-surface-muted border-b border-t border-border flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide">
                              {tag}
                              <span className="text-xs font-normal normal-case text-ink-secondary">
                                {ops.length} operation
                                {ops.length !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            </h4>
                          )}
                          <div className="divide-y divide-border">
                            {ops.map((op) => {
                              const methodColor =
                                METHOD_COLORS[
                                  op.method.toUpperCase()
                                ] ??
                                "bg-surface-muted text-ink-secondary";
                              return (
                                <div
                                  key={`${op.operationId ?? ""}-${op.path}`}
                                  className="px-5 py-3 grid gap-x-3 items-baseline"
                                  style={{
                                    gridTemplateColumns:
                                      "5.5rem 1fr auto",
                                  }}
                                >
                                  <span
                                    className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-mono font-bold uppercase ${methodColor}`}
                                  >
                                    {op.method}
                                  </span>
                                  <div className="min-w-0">
                                    <code className="text-sm font-mono text-ink break-all">
                                      {op.path}
                                    </code>
                                    {op.summary && (
                                      <div className="text-sm text-ink-secondary mt-0.5">
                                        {op.summary}
                                      </div>
                                    )}
                                    {op.scopes.length >
                                      0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {op.scopes.map(
                                          (scope) => (
                                            <span
                                              key={
                                                scope.name
                                              }
                                              title={
                                                scope.description
                                              }
                                              className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-mono"
                                            >
                                              {scope.name}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {op.operationId && (
                                    <span className="text-xs text-ink-secondary font-mono self-start">
                                      {op.operationId}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
