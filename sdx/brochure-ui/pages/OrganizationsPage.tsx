import { Layout } from "../components/Layout.tsx";
import { OrgCard } from "../components/OrgCard.tsx";
import type { Organization, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface OrganizationsPageProps {
  organizations: Organization[];
  subsystemCounts: Record<string, number>;
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

const MEMBER_CLASS_LABELS: Record<string, string> = {
  MIN: "Ministry",
  DIV: "Division",
  USR: "Individual",
  PUB: "Public Body",
};

export function OrganizationsPage({
  organizations,
  subsystemCounts,
  config: _config,
  currentPath,
  user,
}: OrganizationsPageProps) {
  const byClass = organizations.reduce<Record<string, Organization[]>>((acc, org) => {
    const key = org.member.memberClass;
    (acc[key] ??= []).push(org);
    return acc;
  }, {});

  const classOrder = ["MIN", "DIV", "PUB", "USR"];
  const orderedClasses = [
    ...classOrder.filter((c) => byClass[c]),
    ...Object.keys(byClass).filter((c) => !classOrder.includes(c)),
  ];

  return (
    <Layout title="Organizations" currentPath={currentPath} user={user}>
      {/* Page header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Organizations</h1>
          <p className="text-blue-200">
            {organizations.length} organization{organizations.length !== 1 ? "s" : ""} participating in the
            BC Government Secure Data Exchange
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {orderedClasses.map((memberClass) => (
          <section key={memberClass} className="mb-10">
            <h2 className="text-xl font-bold text-[#003366] mb-4 flex items-center gap-3">
              {MEMBER_CLASS_LABELS[memberClass] ?? memberClass}
              <span className="text-sm font-normal text-gray-500">
                ({byClass[memberClass].length})
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {byClass[memberClass].map((org) => (
                <OrgCard
                  key={org.name}
                  org={org}
                  href={`/organizations/${org.name}`}
                  subsystemCount={subsystemCounts[org.name] ?? 0}
                  showClassBadge={false}
                />
              ))}
            </div>
          </section>
        ))}

        {organizations.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">No organizations available.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
