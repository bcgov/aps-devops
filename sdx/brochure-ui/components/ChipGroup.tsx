// Server-side wrapper for the real B.C. Design System Tag/TagGroup/TagList
// (client/IslandTagGroup.tsx), rendered via the islands pattern - see the
// comment on components/Btn.tsx for how that works.
//
// Use for genuinely filterable/categorical labels: environment tabs,
// member-class badges (MIN/DIV/USR/PUB), HTTP-method labels, spec-kind
// labels. Do NOT use for a static verification/approval status indicator
// ("Approved", "Denied", "Pass") - the real TagList renders as a
// keyboard-focusable role="grid" of role="row" cells, which is right for
// selectable/removable chips but wrong for inert status text (it would
// make non-interactive content focusable, an accessibility regression).
// Status pills keep using the existing token-styled <span> pattern
// (bg-support-*/text-support-*) instead - see components/custom for those.

export interface ChipItem {
  id: string;
  label: string;
  color?:
    | "bc-blue"
    | "bc-gold"
    | "blue"
    | "dark"
    | "gray"
    | "grey"
    | "green"
    | "red"
    | "yellow";
  tagStyle?: "rectangular" | "circular";
}

const FALLBACK_COLOR_CLASSES: Record<string, string> = {
  "bc-blue": "bg-bc-blue text-white",
  "bc-gold": "bg-bc-gold text-ink",
  blue: "bg-support-info-bg text-support-info-border",
  green: "bg-support-success-bg text-support-success-border",
  red: "bg-support-danger-bg text-support-danger-border",
  yellow: "bg-support-warning-bg text-ink",
  gray: "bg-surface-muted text-ink-secondary",
  grey: "bg-surface-muted text-ink-secondary",
  dark: "bg-ink text-white",
};

export function ChipGroup(
  { ariaLabel, items, size = "small" }: {
    ariaLabel: string;
    items: ChipItem[];
    size?: "xsmall" | "small" | "medium";
  },
) {
  const islandProps = {
    ariaLabel,
    items: items.map((item) => ({
      id: item.id,
      textValue: item.label,
      color: item.color,
      tagStyle: item.tagStyle ?? "rectangular",
      size,
    })),
  };
  return (
    <span data-bcds-island="IslandTagGroup" data-bcds-props={JSON.stringify(islandProps)}>
      <span className="inline-flex flex-wrap gap-1.5" aria-label={ariaLabel}>
        {items.map((item) => (
          <span
            key={item.id}
            className={[
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border border-border-dark",
              FALLBACK_COLOR_CLASSES[item.color ?? "gray"],
            ].join(" ")}
          >
            {item.label}
          </span>
        ))}
      </span>
    </span>
  );
}
