// Client-only rendering of the real B.C. Design System Button component,
// used for genuine actions (form submits, toggles, JS-driven behavior like
// copy-to-clipboard) rather than navigation - see IslandLink.tsx for that.
//
// className/data-* props are forwarded straight onto the rendered <button>
// (verified: Button spreads ...props onto its underlying element), so any
// existing vanilla-JS click-delegation targeting a class or data attribute
// (e.g. Layout.tsx's copy-button handler) keeps working unchanged against
// the island-rendered button - only its appearance changes.
import { Button } from "@bcgov/design-system-react-components";

export interface IslandButtonProps {
  children: string;
  type?: "button" | "submit" | "reset";
  size?: "xsmall" | "small" | "medium" | "large";
  variant?: "primary" | "secondary" | "tertiary" | "link";
  danger?: boolean;
  isIconButton?: boolean;
  isDisabled?: boolean;
  ariaLabel?: string;
  className?: string;
  // Passed straight through as a DOM attribute (e.g. data-copy for the
  // copy-to-clipboard button) - kept as a flat string map so callers don't
  // need bespoke island props per usage.
  data?: Record<string, string>;
}

export function IslandButton(
  { children, ariaLabel, data, ...props }: IslandButtonProps,
) {
  const dataProps: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    dataProps[`data-${key}`] = value;
  }
  return (
    <Button {...props} {...dataProps} aria-label={ariaLabel}>
      {children}
    </Button>
  );
}
