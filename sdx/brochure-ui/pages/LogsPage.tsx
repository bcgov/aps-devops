import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { CONSOLE_PAGES } from "../components/ConsoleNav.tsx";
import { LogStream } from "../components/LogStream.tsx";
import type { SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface LogsPageProps {
  logStreamUrl: string;
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

export function LogsPage({
  logStreamUrl,
  config: _config,
  currentPath,
  user,
}: LogsPageProps) {
  return (
    <Layout title="Logs" currentPath={currentPath} user={user}>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Member Console", href: "/console" },
          {
            label: "Logs",
            menu: CONSOLE_PAGES.filter((p) => p.href !== "/logs"),
          },
        ]}
      />

      {/* Page header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Logs</h1>
          <p className="text-blue-200">
            Real time request logs of traffic going through SDX Runtime Groups.
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <LogStream streamUrl={logStreamUrl} />
      </div>
    </Layout>
  );
}
