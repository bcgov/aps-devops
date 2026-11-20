import type { ReactNode } from "react";

export function OverflowActions({
  id,
  actions,
}: {
  id: string;
  actions: { label: string; control: ReactNode }[];
}) {
  if (actions.length === 0) return null;

  return (
    <div>
      <div
        data-bcds-island="IslandOverflowActions"
        data-bcds-props={JSON.stringify({
          id,
          labels: actions.map(({ label }) => label),
        })}
      />
      <details id={id} className="relative" data-overflow-actions="">
        <summary
          aria-label="Additional actions"
          className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded border border-border-dark bg-btn-secondary text-ink hover:bg-btn-secondary-hover [&::-webkit-details-marker]:hidden"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="8" cy="3" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="8" cy="13" r="1.4" />
          </svg>
        </summary>
        <div className="absolute right-0 z-20 mt-1 grid w-max min-w-36 gap-1 rounded-lg border border-border bg-white p-1 shadow-lg [&_button]:w-full [&_button]:text-left">
          {actions.map(({ label, control }, index) => (
            <div key={label} data-overflow-index={index}>{control}</div>
          ))}
        </div>
      </details>
    </div>
  );
}
