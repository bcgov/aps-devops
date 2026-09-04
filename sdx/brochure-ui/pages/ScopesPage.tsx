import { Layout } from "../components/Layout.tsx";
import {
  Breadcrumb,
  type Crumb,
} from "../components/Breadcrumb.tsx";
import { CONSOLE_PAGES } from "../components/ConsoleNav.tsx";
import { EnvFilter } from "../components/EnvFilter.tsx";
import { normalizeEnv } from "../lib/environments.ts";
import type {
  ResourceScope,
  ScopeService,
  SiteConfig,
} from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface ScopesPageProps {
  scopes: ResourceScope[];
  error?: string | null;
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
}

const SEARCH_SCRIPT = `
(function(){
  var input = document.getElementById('scope-search');
  var clear = document.getElementById('scope-search-clear');
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-scope-card]'));
  var empty = document.getElementById('scope-empty');
  var count = document.getElementById('scope-count');
  var total = cards.length;
  if(!input) return;
  function label(n, q){
    if(q) return 'Showing ' + n + ' of ' + total + ' scope' + (total === 1 ? '' : 's');
    return total + ' scope' + (total === 1 ? '' : 's');
  }
  function apply(){
    var q = (input.value || '').trim().toLowerCase();
    var shown = 0;
    for(var i=0;i<cards.length;i++){
      var hay = cards[i].getAttribute('data-search') || '';
      var match = !q || hay.indexOf(q) >= 0;
      cards[i].style.display = match ? '' : 'none';
      if(match) shown++;
    }
    if(empty) empty.style.display = shown ? 'none' : '';
    if(count) count.textContent = label(shown, q);
    if(clear) clear.style.display = q ? '' : 'none';
  }
  input.addEventListener('input', apply);
  if(clear) clear.addEventListener('click', function(){ input.value = ''; input.focus(); apply(); });
  apply();
})();
`;

function MetaBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function searchText(scope: ResourceScope): string {
  const parts: string[] = [
    scope.name,
    scope.description ?? "",
    scope.namespace ?? "",
    scope.resourceType ?? "",
    scope.action ?? "",
  ];
  for (const svc of scope.services ?? []) {
    parts.push(svc.name);
    if (svc.subsystem) {
      parts.push(
        svc.subsystem.name,
        svc.subsystem.clientId,
      );
      if (svc.subsystem.organization)
        parts.push(svc.subsystem.organization.name);
    }
    for (const op of svc.operationIds ?? []) parts.push(op);
  }
  return parts.join(" ").toLowerCase();
}

// The environment token for a single backing service. The catalog reports an
// explicit `environment`; we keep it (lower-cased) so environments that have no
// dedicated filter tab — e.g. "lab", "sbx" — stay distinct tokens and get
// filtered out under the dev/test/prod tabs, while known synonyms ("uat",
// "sandbox", …) are normalised onto the canonical ids. Falls back to the
// identifiers embedded in the service for payloads that predate the field;
// returns "" when nothing resolves (such services are environment-agnostic).
function serviceEnvToken(svc: ScopeService): string {
  if (svc.environment) {
    return (
      normalizeEnv(svc.environment) ?? svc.environment.toLowerCase()
    );
  }
  return (
    normalizeEnv(svc.subsystem?.gateway?.id) ??
    normalizeEnv(svc.subsystem?.clientId) ??
    normalizeEnv(svc.name) ??
    ""
  );
}

// A resource scope can be backed by services in several environments at once, so
// the card's env is the union of its services' env tokens (matched token-wise by
// the EnvFilter). Returns "" when nothing resolves — such scopes are
// environment-agnostic and remain visible under every tab.
function scopeEnv(scope: ResourceScope): string {
  const envs = new Set<string>();
  for (const svc of scope.services ?? []) {
    const env = serviceEnvToken(svc);
    if (env) envs.add(env);
  }
  // Namespace as a last resort when no backing service resolved to an environment.
  if (envs.size === 0) {
    const ns = normalizeEnv(scope.namespace);
    if (ns) envs.add(ns);
  }
  return [...envs].join(" ");
}

function ScopeCard({ scope }: { scope: ResourceScope }) {
  const services = scope.services ?? [];
  return (
    <article
      data-scope-card
      data-env-item
      data-env={scopeEnv(scope)}
      data-search={searchText(scope)}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
    >
      <header className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono font-semibold text-[#003366] break-all">
            {scope.name}
          </h2>
          {scope.action && (
            <span className="inline-flex items-center rounded-full bg-[#003366]/10 text-[#003366] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {scope.action}
            </span>
          )}
        </div>
        {scope.description && (
          <p className="text-sm text-gray-600 mt-1">
            {scope.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {scope.namespace && (
            <MetaBadge
              label="namespace"
              value={scope.namespace}
            />
          )}
          {scope.resourceType && (
            <MetaBadge
              label="resource"
              value={scope.resourceType}
            />
          )}
        </div>
      </header>

      <div className="px-4 py-3" data-env-group>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          Grants access to{" "}
          <span className="text-gray-400 normal-case">
            (
            <span data-env-count data-env-noun="service">
              {services.length} service
              {services.length === 1 ? "" : "s"}
            </span>
            )
          </span>
        </h3>
        {services.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No services are mapped to this scope.
          </p>
        ) : (
          <ul className="space-y-3" data-env-items>
            {services.map((svc) => {
              const clientId = svc.subsystem?.clientId;
              const orgName =
                svc.subsystem?.organization?.name;
              return (
                <li
                  key={svc.name}
                  data-env-item
                  data-env={serviceEnvToken(svc)}
                  className="border-l-2 border-gray-200 pl-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {clientId ? (
                      <a
                        href={`/subsystems/${encodeURIComponent(clientId)}`}
                        className="font-mono text-sm text-[#003366] hover:underline break-all"
                      >
                        {svc.name}
                      </a>
                    ) : (
                      <span className="font-mono text-sm text-gray-800 break-all">
                        {svc.name}
                      </span>
                    )}
                    {orgName && (
                      <span className="text-xs text-gray-500">
                        {orgName}
                      </span>
                    )}
                  </div>
                  {svc.operationIds &&
                  svc.operationIds.length > 0 ? (
                    <ul className="flex flex-wrap gap-1 mt-1">
                      {svc.operationIds.map((op) => (
                        <li
                          key={op}
                          className="inline-block bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 font-mono text-xs"
                        >
                          {op}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 italic mt-1">
                      All operations
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}

export function ScopesPage({
  scopes,
  error,
  config: _config,
  currentPath,
  user,
}: ScopesPageProps) {
  const sorted = [...scopes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const breadcrumbItems: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Member Console", href: "/console" },
    {
      label: "Resource Scopes",
      menu: CONSOLE_PAGES.filter(
        (p) => p.href !== "/scopes",
      ),
    },
  ];

  return (
    <Layout
      title="Resource Scopes"
      currentPath={currentPath}
      user={user}
    >
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">
            Resource Scopes
          </h1>
          <p className="text-blue-200">
            Each scope grants an application access to a
            specific set of service operations.
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      {/* Search */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-[260px]">
          <div className="relative max-w-xl">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              id="scope-search"
              type="search"
              autoComplete="off"
              placeholder="Filter scopes…"
              aria-label="Filter scopes"
              className="w-full border border-gray-300 rounded pl-9 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
            />
            <button
              type="button"
              id="scope-search-clear"
              aria-label="Clear search"
              style={{ display: "none" }}
              className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p
            id="scope-count"
            className="text-xs text-gray-500 mt-2"
          />
          </div>
          <EnvFilter label="Environment" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {sorted.length === 0 && !error ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200 text-gray-600">
            No resource scopes are defined.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sorted.map((scope) => (
                <ScopeCard key={scope.name} scope={scope} />
              ))}
            </div>
            <div
              id="scope-empty"
              style={{ display: "none" }}
              className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200 text-gray-600"
            >
              No scopes match your search.
            </div>
          </>
        )}
      </div>

      <script
        dangerouslySetInnerHTML={{ __html: SEARCH_SCRIPT }}
      />
    </Layout>
  );
}
