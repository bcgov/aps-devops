// Client-only rendering of the real B.C. Design System Tag/TagGroup/TagList.
//
// Tag only renders inside a TagList's collection (a bare <Tag> throws), and
// TagList renders as a keyboard-focusable role="grid" of role="row" cells -
// that's the right shape for filterable/removable label chips (environment
// tabs, member-class labels, HTTP-method badges), but WRONG for a static,
// non-interactive verification/approval status pill ("Approved", "Denied",
// "Pass") - making inert text focusable is an accessibility regression, not
// an improvement. Verification/status pills intentionally keep using the
// token-styled <span> pattern (support-success/danger/warning/info) instead
// of this component - see components/custom for those.
import { TagGroup, TagList } from "@bcgov/design-system-react-components";

export interface IslandTagItem {
  id: string;
  textValue: string;
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
  size?: "xsmall" | "small" | "medium";
}

export interface IslandTagGroupProps {
  ariaLabel: string;
  items: IslandTagItem[];
  orientation?: "horizontal" | "vertical";
}

export function IslandTagGroup(
  { ariaLabel, items, orientation }: IslandTagGroupProps,
) {
  return (
    <TagGroup aria-label={ariaLabel}>
      <TagList items={items} orientation={orientation} />
    </TagGroup>
  );
}
