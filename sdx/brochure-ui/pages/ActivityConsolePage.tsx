import { Layout } from "../components/Layout.tsx";
import {
  Breadcrumb,
  type Crumb,
} from "../components/Breadcrumb.tsx";
import { OrgPicker } from "../components/OrgPicker.tsx";
import { CONSOLE_PAGES } from "../components/ConsoleNav.tsx";
import { ActivityFeed } from "../components/ActivityFeed.tsx";
import type {
  ActivityRecord,
  Organization,
  SiteConfig,
} from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface ActivityConsolePageProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  activity: ActivityRecord[];
  pageSize: number;
  error: string | null;
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
}

export function ActivityConsolePage({
  organizations,
  selectedOrg,
  activity,
  pageSize,
  error,
  config: _config,
  currentPath,
  user,
}: ActivityConsolePageProps) {
  const breadcrumbItems: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Member Console", href: "/console" },
    {
      label: "Activity",
      menu: CONSOLE_PAGES.filter(
        (p) => p.href !== "/org-activity",
      ),
    },
  ];
  if (selectedOrg)
    breadcrumbItems.push({ label: selectedOrg.title });

  const apiPath = selectedOrg
    ? `/api/org-activity?org=${encodeURIComponent(selectedOrg.name)}`
    : "/api/org-activity";

  return (
    <Layout
      title="Activity"
      currentPath={currentPath}
      user={user}
    >
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">
            Activity
          </h1>
          <p className="text-blue-200">
            Recent activity for an organization member —
            includes admin access changes, connection
            request lifecycle, subsystem and service
            changes.
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      {/* Picker */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <OrgPicker
            organizations={organizations}
            selectedOrg={selectedOrg}
            action="/org-activity"
            submitLabel="Load activity"
            autoSubmit
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!selectedOrg ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600">
              Select an organization member above to view
              its activity.
            </p>
          </div>
        ) : (
          <ActivityFeed
            activity={activity}
            pageSize={pageSize}
            apiPath={apiPath}
          />
        )}
      </div>
    </Layout>
  );
}
