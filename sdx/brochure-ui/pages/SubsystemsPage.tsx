import { Layout } from "../components/Layout.tsx";
import { SubsystemCard } from "../components/SubsystemCard.tsx";
import type { Subsystem, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface SubsystemsPageProps {
  subsystems: Subsystem[];
  serviceCounts: Record<string, number>;
  query: string;
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

export function SubsystemsPage({ subsystems, serviceCounts, query, config: _config, currentPath, user }: SubsystemsPageProps) {
  return (
    <Layout title="Subsystems" currentPath={currentPath} user={user}>
      {/* Page header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Subsystems</h1>
          <p className="text-blue-200">Browse and search all subsystems in the Secure Data Exchange</p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search form */}
        <form method="get" action="/subsystems" className="mb-8">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search subsystems
          </label>
          <div className="flex gap-2 max-w-xl">
            <input
              id="search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by name, description, or organization…"
              className="flex-1 border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent"
            />
            <button
              type="submit"
              className="bg-[#003366] text-white font-semibold px-5 py-2 rounded hover:bg-[#002654] transition-colors text-sm"
            >
              Search
            </button>
            {query && (
              <a
                href="/subsystems"
                className="border border-gray-300 text-gray-600 font-medium px-4 py-2 rounded hover:bg-gray-50 transition-colors text-sm"
              >
                Clear
              </a>
            )}
          </div>
        </form>

        {/* Results summary */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600 text-sm">
            {query
              ? `${subsystems.length} result${subsystems.length !== 1 ? "s" : ""} for "${query}"`
              : `${subsystems.length} subsystem${subsystems.length !== 1 ? "s" : ""} total`}
          </p>
        </div>

        {/* Subsystem grid */}
        {subsystems.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium mb-2">No subsystems found</p>
            {query && (
              <p className="text-sm">
                Try a different search term or{" "}
                <a href="/subsystems" className="text-[#003366] underline">
                  view all subsystems
                </a>
                .
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subsystems.map((subsystem) => (
              <SubsystemCard
                key={subsystem.clientId}
                subsystem={subsystem}
                href={`/subsystems/${subsystem.clientId}`}
                serviceCount={serviceCounts[subsystem.clientId] ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
