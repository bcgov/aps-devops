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
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-5xl font-bold mb-2">
            Activity
          </h1>
          <p className="text-ink-invert-secondary">
            Recent activity for an organization member —
            includes admin access changes, connection
            request lifecycle, subsystem and service
            changes.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      {/* Picker */}
      <div className="bg-white border-b border-border">
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
