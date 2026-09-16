// Server-side wrapper for the real B.C. Design System Button/Link
// (client/IslandButton.tsx, client/IslandLink.tsx), rendered via the
// islands pattern: a plain, accessible, token-styled fallback (matching
// the recipe already used across the app) inside a data-bcds-island mount
// point, replaced by the real component once public/js/client.js loads -
// see the comment on components/Nav.tsx's <header> for why this can't be
// server-rendered directly (the library injects its CSS at runtime, only
// once its React tree actually mounts in a browser).
//
// Use `href` for navigation - the overwhelming majority of "buttons" in
// this app are really links, and this renders a real <a>, so full
// navigation already works before any JS loads. Omit `href` for a genuine
// action element (form submit, JS-driven behavior) - renders a <button>.
//
// className/data are forwarded to BOTH the fallback and the real
// component, so existing vanilla-JS click-delegation (e.g. Layout.tsx's
// copy-button handler) keeps working unchanged against whichever one is
// currently in the DOM.
//
// `children` must be a plain string (island props are serialized as JSON) -
// for a button with an icon or other JSX content, keep hand-rolling the
// markup instead of using this component.

type Variant = "primary" | "secondary" | "tertiary";
type Size = "xsmall" | "small" | "medium" | "large";

interface BtnCommon {
  variant?: Variant;
  size?: Size;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children: string;
}

interface BtnLinkProps extends BtnCommon {
  href: string;
  target?: string;
  rel?: string;
  type?: undefined;
  data?: undefined;
}

interface BtnActionProps extends BtnCommon {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  data?: Record<string, string>;
}

export type BtnProps = BtnLinkProps | BtnActionProps;

const SIZE_CLASSES: Record<Size, string> = {
  xsmall: "px-3 py-1 text-xs",
  small: "px-3 py-1.5 text-sm",
  medium: "px-4 py-2 text-sm",
  large: "px-6 py-3 text-base",
};

function variantClasses(variant: Variant, danger?: boolean): string {
  if (danger) return "bg-btn-danger text-white hover:bg-btn-danger-hover";
  if (variant === "secondary") {
    return "bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover";
  }
  if (variant === "tertiary") {
    return "bg-transparent text-ink hover:bg-btn-tertiary-hover";
  }
  return "bg-btn-primary text-white hover:bg-btn-primary-hover";
}

function fallbackClassName(props: BtnProps): string {
  const { variant = "primary", size = "medium", danger, disabled, className } = props;
  return [
    "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
    SIZE_CLASSES[size],
    variantClasses(variant, danger),
    disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : undefined,
    className,
  ].filter(Boolean).join(" ");
}

function toDataAttrs(data?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) out[`data-${k}`] = v;
  return out;
}

export function Btn(props: BtnProps) {
  const { variant = "primary", size = "medium", danger, ariaLabel, children } = props;
  const fallbackCls = fallbackClassName(props);

  if (props.href) {
    const { href, target, rel } = props;
    const islandProps = {
      href,
      children,
      target,
      rel,
      size,
      isButton: true,
      buttonVariant: variant,
      danger,
      ariaLabel,
      className: props.className,
    };
    return (
      <span data-bcds-island="IslandLink" data-bcds-props={JSON.stringify(islandProps)}>
        <a
          href={href}
          target={target}
          rel={rel}
          aria-label={ariaLabel}
          className={fallbackCls}
        >
          {children}
        </a>
      </span>
    );
  }

  const { type = "button", disabled, data } = props;
  const islandProps = {
    children,
    type,
    size,
    variant,
    danger,
    isDisabled: disabled,
    ariaLabel,
    className: props.className,
    data,
  };
  return (
    <span data-bcds-island="IslandButton" data-bcds-props={JSON.stringify(islandProps)}>
      <button
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        className={fallbackCls}
        {...toDataAttrs(data)}
      >
        {children}
      </button>
    </span>
  );
}
