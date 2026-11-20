import { CopyButton } from "./custom/CopyButton.tsx";
import { TimeSeriesChart } from "./custom/TimeSeriesChart.tsx";
import { Btn } from "./Btn.tsx";
import type {
  ConnectionRequest,
  ResourceScope,
  Service,
  Subsystem,
} from "../types.ts";

interface AgreementCatalog {
  client?: Subsystem;
  provider?: Subsystem;
  service?: Service;
  scopes?: ReadonlyMap<string, ResourceScope>;
  privacyZoneNames?: ReadonlyMap<string, string>;
}

function PartyContacts({
  access,
  role,
  label,
  empty,
}: {
  access: Subsystem["access"];
  role: string;
  label: string;
  empty: string;
}) {
  const contacts = new Map(
    access?.filter(({ member, roles }) =>
      roles.includes(role) && (member.name || member.email)
    ).map(({ member }) => [member.email || member.name, member]),
  );

  return (
    <div>
      <dt className="text-xs text-ink-secondary">{label}</dt>
      <dd>
        {contacts.size > 0
          ? (
            <ul className="space-y-1">
              {[...contacts].map(([key, { name, email }]) => (
                <li key={key}>
                  {name && <span className="block">{name}</span>}
                  {email && (
                    <div className="flex items-center gap-1">
                      <span className="min-w-0 break-all">{email}</span>
                      <CopyButton value={email} className="shrink-0" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
          : access
          ? empty
          : "Contact information unavailable"}
      </dd>
    </div>
  );
}

export function ConnectionAgreement({
  id,
  org,
  connection,
  catalog,
}: {
  id: string;
  org: string;
  connection: ConnectionRequest;
  catalog?: AgreementCatalog;
}) {
  const { client, provider, service, scopes, privacyZoneNames } = catalog ?? {};
  const granted = connection.isApproved
    ? [
      ...new Set(
        connection.requesterDetails?.scopes ?? connection.scopes ?? [],
      ),
    ]
    : [];
  const serviceScopes = new Map(
    service?.operations.flatMap(({ scopes }) =>
      scopes.map((scope) => [scope.name, scope.description] as const)
    ),
  );
  const trafficQuery = new URLSearchParams({
    org,
    clientId: connection.clientId,
    serviceId: connection.serviceId,
  });

  const parties = [
    {
      heading: "Client Party",
      privacyZone: connection.requesterDetails?.client?.privacyZone,
      access: client?.access,
      organization: client?.organization.title,
      subsystem: client?.name ?? connection.clientId,
      subsystemId: client?.clientId ?? connection.clientId,
    },
    {
      heading: "Service Party",
      privacyZone: connection.requesterDetails?.service?.privacyZone,
      showAccessManagers: true,
      access: provider?.access,
      organization: provider?.organization.title ??
        service?.subsystem.organization.name,
      subsystemId: provider?.clientId ?? service?.subsystem.clientId ??
        connection.serviceResources?.subsystemId,
      subsystem: provider?.name ?? service?.subsystem.name ??
        connection.serviceResources?.subsystemId,
    },
  ];

  return (
    <dialog
      id={id}
      aria-labelledby={`${id}-title`}
      className="sdx-dialog sdx-dialog-wide"
    >
      <header className="border-b border-border px-5 py-4">
        <h2 id={`${id}-title`} className="text-lg font-bold text-bc-blue">
          Information Sharing Agreement
        </h2>
        {connection.id && (
          <p className="mt-1 break-words text-sm text-ink-secondary">
            SDX Connection ID {connection.id}
          </p>
        )}
      </header>
      <div className="max-h-[65vh] space-y-5 overflow-auto px-5 py-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {parties.map((
            {
              heading,
              organization,
              privacyZone,
              subsystem,
              subsystemId,
              access,
              showAccessManagers,
            },
          ) => (
            <section
              key={heading}
              className="rounded-lg border border-border p-3"
            >
              <h3 className="mb-2 font-semibold text-bc-blue">{heading}</h3>
              <dl className="space-y-2 break-words">
                <div>
                  <dt className="text-xs text-ink-secondary">Organization</dt>
                  <dd>{organization ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-secondary">Subsystem</dt>
                  <dd>
                    {subsystemId
                      ? (
                        <a
                          href={`/subsystems/${
                            encodeURIComponent(subsystemId)
                          }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link underline"
                        >
                          {subsystem ?? subsystemId}
                        </a>
                      )
                      : subsystem ?? "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-secondary">Privacy Zone</dt>
                  <dd>
                    {privacyZone
                      ? privacyZoneNames?.get(privacyZone) ?? privacyZone
                      : "Unavailable"}
                  </dd>
                </div>
                <PartyContacts
                  access={access}
                  role="subsystem-owner"
                  label="Owner"
                  empty="No owners listed"
                />
                {showAccessManagers && (
                  <PartyContacts
                    access={access}
                    role="access-manager"
                    label="Access managers"
                    empty="No access managers listed"
                  />
                )}
              </dl>
            </section>
          ))}
        </div>

        <section>
          <h3 className="mb-2 font-semibold text-bc-blue">Granted scopes</h3>
          {granted.length === 0
            ? <p className="text-ink-secondary">No scopes have been granted.</p>
            : (
              <dl className="divide-y divide-border rounded-lg border border-border">
                {granted.map((scope) => (
                  <div key={scope} className="px-3 py-2">
                    <dt className="break-all font-mono font-semibold">
                      {scope}
                    </dt>
                    <dd className="text-ink-secondary">
                      {scopes?.get(scope)?.description ||
                        serviceScopes.get(scope) || "No description available."}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
        </section>

        <section
          data-agreement-traffic={connection.isApproved
            ? `/api/connections/traffic?${trafficQuery}`
            : undefined}
          data-metrics-chart={`${id}-traffic`}
        >
          {connection.isApproved
            ? (
              <>
                <TimeSeriesChart
                  id={`${id}-traffic`}
                  title="Connection traffic · Last 30 days"
                  series={[]}
                  codeField="status"
                  dailyCounts
                />
                <p
                  data-traffic-status
                  role="status"
                  className="mt-2 text-ink-secondary"
                />
              </>
            )
            : (
              <>
                <h3 className="mb-2 font-semibold text-bc-blue">
                  Connection traffic · Last 30 days
                </h3>
                <p className="text-ink-secondary">
                  Traffic is available for approved connections.
                </p>
              </>
            )}
        </section>
      </div>
      <footer className="flex justify-end border-t border-border px-5 py-3">
        <Btn variant="secondary" data={{ "dialog-close": "" }}>Close</Btn>
      </footer>
    </dialog>
  );
}
