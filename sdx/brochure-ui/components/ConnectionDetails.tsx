import { CopyButton } from "./custom/CopyButton.tsx";
import type React from "react";
export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function ProvisionerStatusDetails({ status }: {
  status: import("../types.ts").ConnectionProvisionerStatus;
}) {
  return (
    <DetailSection title="Provisioner status">
      <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1">
        <FieldRow
          label="Status"
          value={status.status}
          mono
        />
        <FieldRow
          label="Message"
          value={status.message}
        />
        {status.endpoint && (
          <>
            <dt className="text-ink-secondary">
              Endpoint
            </dt>
            <dd className="font-mono text-ink break-all">
              <a
                href={status.endpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bc-blue underline hover:no-underline"
              >
                {status.endpoint}
              </a>
              <CopyButton value={status.endpoint} className="ml-2" />
            </dd>
          </>
        )}
        <FieldRow
          label="Spec"
          value={status.spec}
          mono
          copy
        />
      </dl>
    </DetailSection>
  );
}

export function FieldRow({
  label,
  value,
  mono,
  copy = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  copy?: boolean;
}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return (
    <>
      <dt className="text-ink-secondary">{label}</dt>
      <dd
        className={mono
          ? "font-mono text-ink break-all"
          : "text-ink break-all"}
      >
        {value}
        {copy && <CopyButton value={value} className="ml-2" />}
      </dd>
    </>
  );
}

export function ScopeChips({ scopes }: { scopes?: string[] }) {
  if (!scopes || scopes.length === 0) {
    return <span className="text-ink-placeholder italic">none</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {scopes.map((s) => (
        <span
          key={s}
          className="text-xs bg-surface-blue-tint text-bc-blue border border-border px-1.5 py-0.5 rounded font-mono"
        >
          {s}
          <CopyButton value={s} className="ml-1" />
        </span>
      ))}
    </span>
  );
}

export function ClientSubsystemLink({ clientId }: { clientId: string }) {
  return (
    <>
      <a
        href={`/subsystems/${encodeURIComponent(clientId)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        {clientId}
      </a>
      <CopyButton value={clientId} className="ml-2" />
    </>
  );
}
