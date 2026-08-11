import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
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
    <path d="M4 6h16M4 6v12a1 1 0 001 1h14a1 1 0 001-1V6M4 6l1-2h14l1 2M9 11h6" />
  );
}
function TrafficIcon() {
  return <path d="M3 12h4l3 8 4-16 3 8h4" />;
}
function LogsIcon() {
  return (
    <path d="M4 5h16M4 5v14a1 1 0 001 1h14a1 1 0 001-1V5M8 9h8M8 13h8M8 17h5" />
  );
}
function MetricsIcon() {
  return (
    <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3M20 16v-7" />
  );
}
function ConnectionsIcon() {
  return (
    <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM17 22a3 3 0 100-6 3 3 0 000 6zM7 8v5a3 3 0 003 3h4" />
  );
}
function ActivityIcon() {
  return <path d="M22 12h-4l-3 9L9 3l-3 9H2" />;
}
function ScopesIcon() {
  return (
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  );
}

// Long horizontal boxes on the left — the operational resources.
const RESOURCE_CARDS: ConsoleCard[] = [
  {
    label: "Runtime Groups",
    href: "/runtimes",
    description:
      "Runtime groups owned by, and available to, an organization member.",
    icon: <RuntimesIcon />,
  },
  {
    label: "Connection Requests",
    href: "/connections",
    description:
      "Choose an organization to review and manage its connection requests.",
    icon: <ConnectionsIcon />,
  },
  {
    label: "Activity",
    href: "/org-activity",
    description:
      "Choose an organization to view its public and private activity.",
    icon: <ActivityIcon />,
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
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
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
      className="text-gray-300 group-hover:text-[#003366] transition-colors shrink-0"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ResourceCard({ card }: { card: ConsoleCard }) {
  return (
    <a
      href={card.href}
      className="group bg-white border border-gray-200 rounded-lg p-6 hover:border-[#003366] hover:shadow-md transition-all flex items-center gap-5"
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#003366]/5 text-[#003366] shrink-0">
        <CardIcon icon={card.icon} size={26} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xl font-bold text-[#003366] group-hover:underline">
          {card.label}
        </span>
        <span className="block text-sm text-gray-600 mt-0.5">
          {card.description}
        </span>
      </span>
      <CardChevron />
    </a>
  );
}

function TelemetryCard({ card }: { card: ConsoleCard }) {
  return (
    <a
      href={card.href}
      className="group bg-white border border-gray-200 rounded-lg px-4 py-3.5 hover:border-[#003366] hover:shadow-md transition-all flex items-center gap-3"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#003366]/5 text-[#003366] shrink-0">
        <CardIcon icon={card.icon} size={18} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[#003366] group-hover:underline">
          {card.label}
        </span>
        <span className="block text-xs text-gray-500 truncate">
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
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Member Console</h1>
          <p className="text-blue-200">
            Operational tools for organization members — runtime groups, live
            traffic, logs, and connection requests.
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Resources — long horizontal boxes */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
              Resources
            </h2>
            <div className="space-y-4">
              {RESOURCE_CARDS.map((card) => (
                <ResourceCard key={card.href} card={card} />
              ))}
            </div>
          </div>

          {/* Telemetry — compact column */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
              Telemetry
            </h2>
            <div className="space-y-3">
              {TELEMETRY_CARDS.map((card) => (
                <TelemetryCard key={card.href} card={card} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
