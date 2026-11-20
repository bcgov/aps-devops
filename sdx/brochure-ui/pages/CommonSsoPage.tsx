import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import type { SessionUser } from "../lib/auth.ts";

export function CommonSsoPage({
  currentPath,
  user,
}: {
  currentPath: string;
  user: SessionUser;
}) {
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
            Common SSO integration is coming soon.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />
    </Layout>
  );
}
