/** Member Console pages, used for the breadcrumb "jump to" dropdown. */
export const CONSOLE_PAGES: {
  label: string;
  href: string;
}[] = [
  { label: "Subsystems", href: "/org-subsystems" },
  { label: "Connection Requests", href: "/connections" },
  { label: "Edge Runtime Groups", href: "/runtimes" },
  { label: "Resource Scopes", href: "/scopes" },
  { label: "Common SSO", href: "/console/common-sso" },
  { label: "Activity", href: "/org-activity" },
  { label: "Traffic", href: "/traffic" },
  { label: "Logs", href: "/logs" },
  { label: "Metrics", href: "/metrics" },
];

/** Paths that belong to the Member Console section (used for top-nav highlighting). */
export const CONSOLE_PATHS = [
  "/console",
  "/runtimes",
  "/org-subsystems",
  "/traffic",
  "/logs",
  "/metrics",
  "/connections",
  "/org-activity",
  "/scopes",
];

export function isConsolePath(path: string): boolean {
  return CONSOLE_PATHS.some(
    (href) => path === href || path.startsWith(href + "/"),
  );
}
