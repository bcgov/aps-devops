import type { Organization } from "../../types.ts";

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
  const classColor = MEMBER_CLASS_COLORS[org.member.memberClass] ?? "bg-surface-muted text-ink-secondary";

  const inner = (
    <div className="bg-white rounded-lg border border-border shadow-sm p-5 hover:shadow-md hover:border-border-medium transition-all flex flex-col gap-2 h-full">
      <div className="flex items-start justify-between gap-2">
        {showClassBadge
          ? (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${classColor}`}>
              {classLabel}
            </span>
          )
          : <span />}
        <span className="text-xs text-ink-secondary font-mono">{org.member.memberId}</span>
      </div>
      <h3 className="text-bc-blue font-bold text-lg leading-snug">{org.title}</h3>
      {org.description && (
        <p className="text-ink-secondary text-sm">{org.description}</p>
      )}
      {subsystemCount !== undefined && (
        <div className="mt-auto pt-3 text-xs text-ink-secondary">
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
