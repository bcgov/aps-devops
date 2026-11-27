import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import type { SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface ConsolePageProps {
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
}

interface ConsoleCard {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
}

function RuntimesIcon() {
  return (
    <path d="M2 8h7a2 2 0 012 2v1h3V5h4V3h4v4h-4V6h-2v5h2V10h4v4h-4v-1h-2v5h2v-1h4v4h-4v-2h-4v-6h-3v1a2 2 0 01-2 2H2z" />
  );
}

function TrafficIcon() {
  return <path d="M1 11h5l3 5 4-13 4 8h6v2h-7l-2.5-5L10 21l-5-8H1z" />;
}

function LogsIcon() {
  return (
    <path
      fillRule="evenodd"
      d="M5 2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2zm2 5v2h10V7zm0 4v2h10v-2zm0 4v2h7v-2z"
    />
  );
}

function MetricsIcon() {
  return (
    <path d="M2 3h3v16h17v3H2zm5 9h3v5H7zm4-5h3v10h-3zm4 3h3v7h-3zm4-7h3v14h-3z" />
  );
}

function ConnectionsIcon() {
  return (
    <path d="M6 2a4 4 0 011 7.9V13a2 2 0 002 2h3v-3l4 4-4 4v-3H9a4 4 0 01-4-4V9.9A4 4 0 016 2zm13 11a4 4 0 110 8 4 4 0 010-8z" />
  );
}

function ActivityIcon() {
  return (
    <path
      fillRule="evenodd"
      d="M9 2h6v3h4a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4zm-2 9-1 1 2 2 4-4-1-1-3 3zm6 0v2h5v-2zm-6 6-1 1 2 2 4-4-1-1-3 3zm6 0v2h5v-2z"
    />
  );
}

function IdentityIcon() {
  return (
    <>
      <circle cx="8" cy="6" r="4" />
      <path d="M1 20v-3a5 5 0 015-5h4a5 5 0 012 .4c.1 3.8 1.4 6.6 3.8 8.6H2a1 1 0 01-1-1z" />
      <path
        fillRule="evenodd"
        d="M18 10l5 2v2c0 4-2 6.8-5 8-3-1.2-5-4-5-8v-2zm0 2.2v7.5c1.9-1.1 3-3.1 3-5.7v-.7z"
      />
    </>
  );
}

function ScopesIcon() {
  return (
    <>
      <path
        fillRule="evenodd"
        d="M4 2h8l5 5v2l-6 2.5V14c0 3 1 5.3 3 7H4a2 2 0 01-2-2V4a2 2 0 012-2zm7 2v4h4zM5 8v2h4V8zm0 5v2h4v-2z"
      />
      <path
        fillRule="evenodd"
        d="M18 10l5 2v2c0 4-2 6.8-5 8-3-1.2-5-4-5-8v-2zm-2.2 4.7-1 1 2.4 2.4 4-4-1-1-3 3z"
      />
    </>
  );
}

function SubsystemsIcon() {
  return (
    <>
      <path
        fillRule="evenodd"
        d="M3 3h16a2 2 0 012 2v4h-2V8H3v10h9v2H3a2 2 0 01-2-2V5a2 2 0 012-2zm1 2v1.5h1.5V5zm3 0v1.5h1.5V5z"
      />
      <path d="M5 10h7v2H5zm0 4h5v2H5z" />
      <ellipse cx="18" cy="11.5" rx="5" ry="2.5" />
      <path d="M13 14c2.5 1.8 7.5 1.8 10 0v2c0 1.4-2.2 2.5-5 2.5s-5-1.1-5-2.5zm0 4.5c2.5 1.8 7.5 1.8 10 0v2c0 1.4-2.2 2.5-5 2.5s-5-1.1-5-2.5z" />
    </>
  );
}

// Long horizontal boxes on the left — the operational resources.
const RESOURCE_CARDS: ConsoleCard[] = [
  {
    label: "Subsystems",
    href: "/org-subsystems",
    description:
      "Choose an organization to browse its subsystems and view full client detail.",
    icon: <SubsystemsIcon />,
  },
  {
    label: "Connection Requests",
    href: "/connections",
    description:
      "Choose an organization to review and manage its connection requests.",
    icon: <ConnectionsIcon />,
  },
  {
    label: "Edge Runtime Groups",
    href: "/runtimes",
    description:
      "Runtime groups owned by, and available to, an organization member.",
    icon: <RuntimesIcon />,
  },
  {
    label: "Resource Scopes",
    href: "/scopes",
    description:
      "Browse scopes and the service operations each one grants access to.",
    icon: <ScopesIcon />,
  },
];

// Compact telemetry boxes on the right.
const TELEMETRY_CARDS: ConsoleCard[] = [
  {
    label: "Activity",
    href: "/org-activity",
    description: "View public and private activity for an organization",
    icon: <ActivityIcon />,
  },
  {
    label: "Traffic",
    href: "/traffic",
    description: "Live traffic flowing between runtime groups.",
    icon: <TrafficIcon />,
  },
  {
    label: "Logs",
    href: "/logs",
    description: "Real-time request logs from Kong.",
    icon: <LogsIcon />,
  },
  {
    label: "Metrics",
    href: "/metrics",
    description: "Request rate by service and response code.",
    icon: <MetricsIcon />,
  },
];

function CardIcon({
  icon,
  size = 22,
}: {
  icon: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

function CardChevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-border-medium group-hover:text-bc-blue transition-colors shrink-0"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ResourceCard({ card }: { card: ConsoleCard }) {
  return (
    <a
      href={card.href}
      className="group bg-white border border-border rounded-lg p-6 hover:border-bc-blue hover:shadow-md transition-all flex items-center gap-5"
    >
      <span className="inline-flex items-center justify-center w-12 h-12 text-bc-blue shrink-0">
        <CardIcon icon={card.icon} size={36} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xl font-bold text-bc-blue group-hover:underline">
          {card.label}
        </span>
        <span className="block text-sm text-ink-secondary mt-0.5">
          {card.description}
        </span>
      </span>
      <CardChevron />
    </a>
  );
}

function CompactCard({ card }: { card: ConsoleCard }) {
  return (
    <a
      href={card.href}
      className="group bg-white border border-border rounded-lg px-4 py-3.5 hover:border-bc-blue hover:shadow-md transition-all flex items-center gap-3"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 text-bc-blue shrink-0">
        <CardIcon icon={card.icon} size={26} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-bc-blue group-hover:underline">
          {card.label}
        </span>
        <span className="block text-xs text-ink-secondary truncate">
          {card.description}
        </span>
      </span>
      <CardChevron />
    </a>
  );
}

export function ConsolePage({
  config: _config,
  currentPath,
  user,
}: ConsolePageProps) {
  return (
    <Layout title="Member Console" currentPath={currentPath} user={user}>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Member Console" },
        ]}
      />

      {/* Header */}
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-5xl font-bold mb-2">Member Console</h1>
          <p className="text-ink-invert-secondary">
            Operational tools for organization members — runtime groups, live
            traffic, logs, and connection requests.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Resources — long horizontal boxes */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-secondary mb-3">
              Manage Resources
            </h2>
            <div className="space-y-4">
              {RESOURCE_CARDS.map((card) => (
                <ResourceCard key={card.href} card={card} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-secondary mb-3">
                Consumer Applications
              </h2>
              <CompactCard
                card={{
                  label: "Common SSO Integrations",
                  href: "/console/common-sso",
                  description: "Common single sign-on integration.",
                  icon: <IdentityIcon />,
                }}
              />
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-secondary mb-3">
                Telemetry
              </h2>
              <div className="space-y-3">
                {TELEMETRY_CARDS.map((card) => (
                  <CompactCard key={card.href} card={card} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
