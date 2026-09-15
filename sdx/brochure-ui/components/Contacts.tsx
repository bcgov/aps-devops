import type { SubsystemAccess } from "../types.ts";

const ROLE_LABELS: Record<string, string> = {
  "access-manager": "Access Manager",
  "tech-lead": "Tech Lead",
};

function roleLabel(role: string): string {
  return (
    ROLE_LABELS[role] ??
    role
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function Contacts({
  contacts,
  description,
}: {
  contacts: SubsystemAccess[];
  description: string;
}) {
  if (contacts.length === 0) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-2xl font-bold text-[#003366] mb-1">
        Contacts
        <span className="ml-2 text-base font-normal text-gray-500">
          ({contacts.length}{" "}
          {contacts.length !== 1 ? "people" : "person"})
        </span>
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        {description}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contacts.map((contact, i) => {
          const name =
            contact.member.name ??
            contact.member.email ??
            "Unknown";
          const email = contact.member.email;
          return (
            <div
              key={email ?? name ?? i}
              className="bg-white rounded-lg border border-gray-200 px-5 py-4"
            >
              <div className="font-semibold text-gray-800">
                {name}
              </div>
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="text-sm text-[#003366] hover:underline break-all"
                >
                  {email}
                </a>
              )}
              {contact.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {contact.roles.map((role) => (
                    <span
                      key={role}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium"
                    >
                      {roleLabel(role)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
