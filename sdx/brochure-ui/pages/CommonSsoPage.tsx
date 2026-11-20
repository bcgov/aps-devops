import { ActivityFeed } from "../components/custom/ActivityFeed.tsx";
import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import type { ActivityRecord } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

export function CommonSsoPage({
  currentPath,
  user,
  activity,
  error,
}: {
  currentPath: string;
  user: SessionUser;
  activity: ActivityRecord[];
  error?: string;
}) {
  const sorted = activity.toSorted((a, b) =>
    Date.parse(b.activityAt) - Date.parse(a.activityAt)
  );
  const seen = new Set<string>();
  const submissions = sorted.filter(({ params }) => {
    if (seen.has(params.submissionId)) return false;
    seen.add(params.submissionId);
    return true;
  });

  return (
    <Layout title="Common SSO" currentPath={currentPath} user={user}>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Member Console", href: "/console" },
          { label: "Common SSO" },
        ]}
      />
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-4xl font-bold mb-2">Common SSO</h1>
          <p className="text-ink-invert-secondary">
            View the latest status of your integration access requests.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="mb-4 text-2xl font-bold text-bc-blue">My Submissions</h2>
        {error
          ? (
            <p
              role="alert"
              className="rounded-lg border border-support-danger-border bg-support-danger-bg p-4"
            >
              {error}
            </p>
          )
          : <ActivityFeed activity={submissions} apiPath={null} />}
      </section>
    </Layout>
  );
}
