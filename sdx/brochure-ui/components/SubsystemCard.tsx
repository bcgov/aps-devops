import type { Subsystem } from "../types.ts";

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

export function SubsystemCard(
  { subsystem, href, serviceCount }: {
    subsystem: Subsystem;
    href?: string;
    serviceCount?: number;
  },
) {
  const classLabel = MEMBER_CLASS_LABELS[subsystem.member.memberClass] ?? subsystem.member.memberClass;
  const classColor = MEMBER_CLASS_COLORS[subsystem.member.memberClass] ?? "bg-gray-100 text-gray-700";

  const showServiceBadge = serviceCount !== undefined;
  const isClientOnly = serviceCount === 0;
  const serviceBadgeLabel = isClientOnly
    ? "Client only"
    : `${serviceCount} ${serviceCount === 1 ? "service" : "services"}`;
  const serviceBadgeColor = isClientOnly
    ? "bg-gray-100 text-gray-600 border border-gray-200"
    : "bg-emerald-50 text-emerald-700 border border-emerald-200";

  const inner = (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-[#003366] transition-all flex flex-col gap-2 h-full">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
          {subsystem.organization.title}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${classColor}`}>
          {classLabel}
        </span>
      </div>
      <h3 className="text-[#003366] font-bold text-lg leading-snug">{subsystem.name}</h3>
      {subsystem.description && (
        <p className="text-gray-600 text-sm line-clamp-3">{subsystem.description}</p>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 font-mono truncate">{subsystem.clientId}</span>
        {showServiceBadge && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${serviceBadgeColor}`}
          >
            {serviceBadgeLabel}
          </span>
        )}
      </div>
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
