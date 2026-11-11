// Client-only rendering of the real B.C. Design System Link component,
// used wherever the app has a navigation <a> styled to look like a button
// (the vast majority of "buttons" in this app are really links). Renders as
// a real <a href>, so - unlike IslandButton.tsx - the server-rendered
// fallback already provides full navigation without JS; this island only
// upgrades its visual styling once the bundle loads.
import { Link } from "@bcgov/design-system-react-components";

export interface IslandLinkProps {
  href: string;
  children: string;
  target?: string;
  rel?: string;
  size?: "small" | "medium" | "large";
  isButton?: boolean;
  buttonVariant?: "primary" | "secondary" | "tertiary";
  danger?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function IslandLink(
  { children, ariaLabel, ...props }: IslandLinkProps,
) {
  return (
    <Link {...props} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
