import type { Subsystem } from "../../types.ts";

const MEMBER_CLASS_LABELS: Record<string, string> = {
  MIN: "Ministry",
  DIV: "Division",
  USR: "Individual",
  PUB: "Public Body",
};

const MEMBER_CLASS_COLORS: Record<string, string> = {
  MIN: "bg-support-info-bg text-support-info-border",
  DIV: "bg-support-success-bg text-support-success-border",
  USR: "bg-surface-muted text-ink-secondary",
  PUB: "bg-surface-blue-tint text-bc-blue",
};

export function SubsystemCard(
  { subsystem, href, serviceCount, showOrganization = true }: {
    subsystem: Subsystem;
    href?: string;
    serviceCount?: number;
    showOrganization?: boolean;
  },
) {
  const classLabel = MEMBER_CLASS_LABELS[subsystem.member.memberClass] ?? subsystem.member.memberClass;
  const classColor = MEMBER_CLASS_COLORS[subsystem.member.memberClass] ?? "bg-surface-muted text-ink-secondary";

  const showServiceBadge = serviceCount !== undefined;
  const isClientOnly = serviceCount === 0;
  const serviceBadgeLabel = isClientOnly
    ? "Client only"
    : `${serviceCount} ${serviceCount === 1 ? "service" : "services"}`;
  const serviceBadgeColor = isClientOnly
    ? "bg-surface-muted text-ink-secondary"
    : "bg-support-success-bg text-support-success-border";

  const inner = (
    <div className="bg-white rounded-lg border border-border shadow-sm p-5 hover:shadow-md hover:border-border-medium transition-all flex flex-col gap-2 h-full">
      {showOrganization && (
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-ink-secondary font-medium uppercase tracking-wide">
            {subsystem.organization.title}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${classColor}`}>
            {classLabel}
          </span>
        </div>
      )}
      <h3 className="text-bc-blue font-bold text-lg leading-snug">{subsystem.name}</h3>
      {subsystem.description && (
        <p className="text-ink-secondary text-sm line-clamp-3">{subsystem.description}</p>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-secondary font-mono truncate">{subsystem.clientId}</span>
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
