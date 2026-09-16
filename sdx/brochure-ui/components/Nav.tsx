import type { SessionUser } from "../lib/auth.ts";
import { isConsolePath } from "./custom/ConsoleNav.tsx";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Subsystems", href: "/subsystems" },
  { label: "Organizations", href: "/organizations" },
  { label: "Trust Services", href: "/trust" },
  {
    label: "Member Console",
    href: "/console",
    authRequired: true,
  },
];

const HELP_URL =
  "https://developer.gov.bc.ca/docs/default/component/aps-infra-platform-docs/concepts/secure-data-exchange/";

function Chevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface NavProps {
  currentPath: string;
  user?: SessionUser | null;
  authEnabled?: boolean;
  hideMainNav?: boolean;
  bannerTitle?: string;
  bannerHref?: string;
}

export function Nav({
  currentPath,
  user,
  authEnabled,
  hideMainNav,
  bannerTitle = "Secure Data Exchange",
  bannerHref = "/",
}: NavProps) {
  const displayName =
    user?.name ||
    user?.preferred_username ||
    user?.email ||
    user?.sub ||
    "Account";

  // Passed to the real Header/Subheader components (client/AppChrome.tsx),
  // which take over this element once public/js/client.js loads - see the
  // comment on <header> below.
  const islandProps = {
    currentPath,
    bannerTitle,
    bannerHref,
    helpUrl: HELP_URL,
    hideMainNav,
    authEnabled,
    loginHref: `/auth/login?returnTo=${encodeURIComponent(currentPath)}`,
    logoutHref: "/auth/logout",
    userDisplayName: authEnabled && user ? displayName : undefined,
    userEmail: authEnabled && user ? user.email : undefined,
    navItems: NAV_ITEMS.filter((item) => !item.authRequired || user).map(
      ({ label, href }) => ({ label, href }),
    ),
  };

  return (
    <header
      data-bcds-island="AppChrome"
      data-bcds-props={JSON.stringify(islandProps)}
    >
      {/* Server-rendered fallback, matching the B.C. Design System Header/
          Subheader anatomy (solid white background, solid grey bottom
          border, hyperlinked logo left, title beside it, nav container
          right; subheader items as a horizontal list with vertical
          dividers). Visible until public/js/client.js mounts the real
          <Header>/<Subheader> components here (see client/AppChrome.tsx) -
          the library ships no CSS of its own until its React tree actually
          runs in the browser, so this fallback is what no-JS users, and
          everyone else before that script loads, will see. */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <a
              href={bannerHref}
              className="flex items-center shrink-0 rounded-sm"
            >
              <img
                src="/public/bcid-logo-positive.png"
                alt="Government of British Columbia"
                className="h-9 w-auto"
              />
            </a>
            <span className="w-px self-stretch bg-border" aria-hidden="true" />
            <a
              href={bannerHref}
              className="text-bc-blue font-bold text-lg sm:text-xl truncate hover:text-bc-blue-hover transition-colors rounded-sm"
            >
              {bannerTitle}
            </a>
          </div>

          <nav
            className="flex items-center gap-1 text-sm shrink-0"
            aria-label="Account"
          >
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-sm text-ink-secondary hover:text-bc-blue hover:bg-surface-muted transition-colors"
            >
              Help <Chevron />
            </a>

            {authEnabled && user ? (
              <details className="relative group">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 px-3 py-2 rounded-sm text-ink-secondary hover:text-bc-blue hover:bg-surface-muted transition-colors">
                  <span className="truncate max-w-[160px]">
                    {displayName}
                  </span>
                  <Chevron />
                </summary>
                <div className="absolute right-0 top-full bg-white text-ink shadow-lg rounded border border-border min-w-[200px] z-50 py-1">
                  {user.email && (
                    <div className="px-4 py-2 text-xs text-ink-secondary border-b border-border truncate">
                      {user.email}
                    </div>
                  )}
                  <a
                    href="/auth/logout"
                    className="block px-4 py-2 text-sm hover:bg-surface-muted"
                  >
                    Logout
                  </a>
                </div>
              </details>
            ) : (
              <a
                href={`/auth/login?returnTo=${encodeURIComponent(currentPath)}`}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-sm text-ink-secondary hover:text-bc-blue hover:bg-surface-muted transition-colors"
              >
                Login <Chevron />
              </a>
            )}
          </nav>
        </div>
      </div>

      {/* B.C. Design System Subheader: padding aligned with the header,
          solid bottom border, items as a horizontal list with vertical
          dividers automatically rendered between each item. */}
      {!hideMainNav && (
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav aria-label="Main navigation">
              <ul className="flex flex-wrap">
                {NAV_ITEMS.filter(
                  (item) => !item.authRequired || user,
                ).map((item, i) => {
                  const isActive =
                    item.href === "/console"
                      ? isConsolePath(currentPath)
                      : currentPath === item.href ||
                        (item.href !== "/" &&
                          currentPath.startsWith(
                            item.href + "/",
                          ));
                  return (
                    <li
                      key={item.href}
                      className={
                        i > 0 ? "border-l border-border" : undefined
                      }
                    >
                      <a
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "block px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "text-bc-blue font-semibold"
                            : "text-ink-secondary hover:text-bc-blue hover:bg-surface-muted",
                        ].join(" ")}
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
