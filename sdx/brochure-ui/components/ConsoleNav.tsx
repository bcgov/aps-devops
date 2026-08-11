/** Member Console pages, used for the breadcrumb "jump to" dropdown. */
export const CONSOLE_PAGES: {
  label: string;
  href: string;
}[] = [
  { label: "Runtime Groups", href: "/runtimes" },
  { label: "Connection Requests", href: "/connections" },
  { label: "Activity", href: "/org-activity" },
  { label: "Resource Scopes", href: "/scopes" },
  { label: "Traffic", href: "/traffic" },
  { label: "Logs", href: "/logs" },
  { label: "Metrics", href: "/metrics" },
];

/** Paths that belong to the Member Console section (used for top-nav highlighting). */
export const CONSOLE_PATHS = [
  "/console",
  "/runtimes",
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
