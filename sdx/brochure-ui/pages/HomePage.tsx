import { Layout } from "../components/Layout.tsx";
import { StatCard } from "../components/StatCard.tsx";
import { SubsystemCard } from "../components/SubsystemCard.tsx";
import type { Subsystem, Organization, Service, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface HomePageProps {
  subsystems: Subsystem[];
  organizations: Organization[];
  services: Service[];
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

export function HomePage({ subsystems, organizations, services, config, currentPath, user }: HomePageProps) {
  const featured = subsystems.slice(0, 6);

  const serviceProviders = new Set(
    services.map((s) => s.subsystem.organization.name),
  ).size;

  return (
    <Layout title="Home" currentPath={currentPath} user={user}>
      {/* Hero section */}
      <section
        className="relative text-white"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(0,51,102,0.82), rgba(0,51,102,0.88))",
            "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')",
          ].join(", "),
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              {config.site.description}
            </h1>
            <p className="text-blue-200 text-lg mb-10">{config.site.subtitle}</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <StatCard value={subsystems.length} label="Subsystems" href="/subsystems" />
            <StatCard value={organizations.length} label="Organizations" href="/organizations" />
            <StatCard value={serviceProviders} label="Service Providers" />
          </div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="h-1 bg-[#FCBA19]" />

      {/* Intro section */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-[#003366] mb-4">
              About the Secure Data Exchange
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The BC Government Secure Data Exchange (SDX) provides a uniform and secure solution
              for inter-organization data transfers across government ministries, agencies, and
              authorized partners. This catalogue allows you to discover the subsystems and
              organizations participating in the data exchange layer.
            </p>
            <a
              href={config.support_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#003366] font-semibold hover:underline"
            >
              Learn more about the Secure Data Exchange
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* Featured subsystems */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#003366]">Subsystems</h2>
            <a
              href="/subsystems"
              className="text-sm font-medium text-[#003366] hover:underline flex items-center gap-1"
            >
              Browse all subsystems <span aria-hidden="true">→</span>
            </a>
          </div>

          {featured.length === 0 ? (
            <p className="text-gray-500">No subsystems available.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((subsystem) => (
                <SubsystemCard
                  key={subsystem.clientId}
                  subsystem={subsystem}
                  href={`/subsystems/${subsystem.clientId}`}
                />
              ))}
            </div>
          )}

          {subsystems.length > 6 && (
            <div className="mt-8 text-center">
              <a
                href="/subsystems"
                className="inline-block bg-[#003366] text-white font-semibold px-6 py-3 rounded hover:bg-[#002654] transition-colors"
              >
                Browse all {subsystems.length} subsystems
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Organizations teaser */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#003366]">Organizations</h2>
            <a
              href="/organizations"
              className="text-sm font-medium text-[#003366] hover:underline flex items-center gap-1"
            >
              Browse all organizations <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="text-gray-700 mb-6">
            {organizations.length} organizations participate in the BC Government Secure Data Exchange,
            including ministries, divisions, and authorized service providers.
          </p>
          <a
            href="/organizations"
            className="inline-block border-2 border-[#003366] text-[#003366] font-semibold px-6 py-3 rounded hover:bg-[#003366] hover:text-white transition-colors"
          >
            View all organizations
          </a>
        </div>
      </section>
    </Layout>
  );
}
