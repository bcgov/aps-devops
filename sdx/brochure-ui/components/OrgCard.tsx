import type { Organization } from "../types.ts";

const MEMBER_CLASS_LABELS: Record<string, string> = {
  MIN: "Ministry",
  DIV: "Division",
  USR: "Individual",
  PUB: "Public Body",
};

const MEMBER_CLASS_COLORS: Record<string, string> = {
  MIN: "bg-blue-100 text-blue-800",
  DIV: "bg-green-100 text-green-800",
  USR: "bg-gray-100 text-gray-700",
  PUB: "bg-purple-100 text-purple-800",
};

export function OrgCard({
  org,
  href,
  subsystemCount,
  showClassBadge = true,
}: {
  org: Organization;
  href?: string;
  subsystemCount?: number;
  showClassBadge?: boolean;
}) {
  const classLabel = MEMBER_CLASS_LABELS[org.member.memberClass] ?? org.member.memberClass;
  const classColor = MEMBER_CLASS_COLORS[org.member.memberClass] ?? "bg-gray-100 text-gray-700";

  const inner = (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-[#003366] transition-all flex flex-col gap-2 h-full">
      <div className="flex items-start justify-between gap-2">
        {showClassBadge
          ? (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${classColor}`}>
              {classLabel}
            </span>
          )
          : <span />}
        <span className="text-xs text-gray-400 font-mono">{org.member.memberId}</span>
      </div>
      <h3 className="text-[#003366] font-bold text-lg leading-snug">{org.title}</h3>
      {org.description && (
        <p className="text-gray-600 text-sm">{org.description}</p>
      )}
      {subsystemCount !== undefined && (
        <div className="mt-auto pt-3 text-xs text-gray-400">
          {subsystemCount} subsystem{subsystemCount !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {inner}
      </a>
    );
  }
  return inner;
}
