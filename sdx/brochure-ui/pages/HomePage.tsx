import { Layout } from "../components/Layout.tsx";
import { Btn } from "../components/Btn.tsx";
import { StatCard } from "../components/custom/StatCard.tsx";
import { SubsystemCard } from "../components/custom/SubsystemCard.tsx";
import { SDX_DOCS_URL } from "../lib/links.ts";
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
        className="relative text-ink-invert sdx-on-dark"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(1,51,102,0.82), rgba(1,51,102,0.88))",
            "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')",
          ].join(", "),
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
              {config.site.description}
            </h1>
            <p className="text-ink-invert-secondary text-lg mb-10">{config.site.subtitle}</p>
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
      <div className="h-1 bg-bc-gold" />

      {/* Intro row under the banner */}
      <section className="bg-surface-muted py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-border shadow-sm p-5 hover:shadow-md hover:border-border-medium transition-all">
              <h2 className="text-xl font-bold text-bc-blue mb-3">
                About the SDX Catalogue
              </h2>
              <p className="text-ink leading-relaxed mb-4">
                Learn what you can find in the catalogue, including subsystems,
                organizations and trust services.
              </p>
              <a
                href="/about"
                className="inline-flex items-center gap-2 text-bc-blue font-semibold hover:underline rounded-sm"
              >
                Read about the catalogue
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="bg-white rounded-lg border border-border shadow-sm p-5 hover:shadow-md hover:border-border-medium transition-all">
              <h2 className="text-xl font-bold text-bc-blue mb-3">
                Learn about SDX
              </h2>
              <p className="text-ink leading-relaxed mb-4">
                Learn how SDX works, how organizations get started and where to
                find technical guides.
              </p>
              <a
                href={SDX_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-bc-blue font-semibold hover:underline rounded-sm"
              >
                Read the SDX documentation
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Featured subsystems */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold text-bc-blue">Subsystems</h2>
            <a
              href="/subsystems"
              className="text-sm font-medium text-bc-blue hover:underline flex items-center gap-1 rounded-sm"
            >
              Browse all subsystems <span aria-hidden="true">→</span>
            </a>
          </div>

          {featured.length === 0 ? (
            <p className="text-ink-secondary">No subsystems available.</p>
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
              <Btn href="/subsystems" size="large">
                {`Browse all ${subsystems.length} subsystems`}
              </Btn>
            </div>
          )}
        </div>
      </section>

      {/* Organizations teaser */}
      <section className="bg-surface-muted py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-bold text-bc-blue">Organizations</h2>
            <a
              href="/organizations"
              className="text-sm font-medium text-bc-blue hover:underline flex items-center gap-1 rounded-sm"
            >
              Browse all organizations <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="text-ink mb-6">
            {organizations.length} organizations participate in the BC Government Secure Data Exchange,
            including ministries, divisions, and authorized service providers.
          </p>
          <a
            href="/organizations"
            className="inline-flex items-center justify-center gap-2 rounded font-medium transition-colors border-2 border-bc-blue text-bc-blue hover:bg-bc-blue hover:text-white px-6 py-3 text-base"
          >
            View all organizations
          </a>
        </div>
      </section>
    </Layout>
  );
}
