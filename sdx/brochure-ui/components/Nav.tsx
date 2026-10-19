import type { SessionUser } from "../lib/auth.ts";
import { CONSOLE_PAGES, isConsolePath } from "./custom/ConsoleNav.tsx";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Subsystems", href: "/subsystems" },
  { label: "Organizations", href: "/organizations" },
  { label: "Trust Services", href: "/trust" },
  {
    label: "Member Console",
    href: "/console",
    authRequired: true,
  },
];

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
    helpUrl: "/help",
    hideMainNav,
    authEnabled,
    loginHref: `/auth/login?returnTo=${encodeURIComponent(currentPath)}`,
    logoutHref: "/auth/logout",
    userDisplayName: authEnabled && user ? displayName : undefined,
    userEmail: authEnabled && user ? user.email : undefined,
    navItems: NAV_ITEMS.filter((item) => !item.authRequired || user).map(
      ({ label, href }) => ({ label, href }),
    ),
    consolePages: user ? CONSOLE_PAGES : [],
  };

  return (
    // A plain, non-landmark <div> mount point - NOT a <header> itself. The
    // real client-rendered <Header>/<Subheader> (client/AppChrome.tsx) each
    // render their own <header>/nav landmark, same as the static fallback
    // below; mounting onto a <header> here would nest one <header> inside
    // another once the island replaces this element's children.
    <div
      className="sdx-chrome"
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
      <header className="sdx-header">
        <div className="sdx-brand">
          <a
            href={bannerHref}
            aria-label="Government of British Columbia"
            className="sdx-logo"
          >
            <img src="/public/bcid-logo-positive.png" alt="" />
          </a>
          <span className="sdx-brand-rule" aria-hidden="true" />
          <a href={bannerHref} className="sdx-title">
            {bannerTitle}
          </a>
        </div>
        <div className="sdx-tools">
          <a
            href="/help"
            aria-current={currentPath === "/help" ? "page" : undefined}
            className="sdx-tool-link"
          >
            Help
          </a>
          {authEnabled && user ? (
            <details className="sdx-account">
              <summary className="sdx-account-summary">
                Account <Chevron />
              </summary>
              <div className="sdx-account-menu">
                {user.email && (
                  <p className="sdx-account-email">{user.email}</p>
                )}
                <a href="/auth/logout">Logout</a>
              </div>
            </details>
          ) : (
            <a
              href={`/auth/login?returnTo=${encodeURIComponent(currentPath)}`}
              className="sdx-tool-link"
            >
              Login
            </a>
          )}
          {!hideMainNav && (
            <button
              type="button"
              className="sdx-menu-btn"
              aria-expanded="false"
              aria-controls="sdx-main-menu"
            >
              Menu
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1 3h14M1 8h14M1 13h14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>
      </header>
      {!hideMainNav && (
        <nav id="sdx-main-menu" className="sdx-main-nav" aria-label="Main navigation">
          <div className="sdx-main-nav-inner">
            <ul>
              {NAV_ITEMS.filter((item) => !item.authRequired || user).map(
                (item) => {
                  const isActive = item.href === "/console"
                    ? isConsolePath(currentPath)
                    : currentPath === item.href ||
                      (item.href !== "/" &&
                        currentPath.startsWith(item.href + "/"));
                  if (item.href !== "/console") {
                    return (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="sdx-nav-link"
                          aria-current={isActive ? "page" : undefined}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <div
                        className="sdx-console"
                        data-active={isActive ? "true" : "false"}
                      >
                        <a
                          href="/console"
                          className="sdx-nav-link"
                          aria-current={
                            currentPath === "/console" ? "page" : undefined
                          }
                        >
                          {item.label}
                        </a>
                        <details>
                          <summary
                            className="sdx-console-summary"
                            aria-label="Member Console sections"
                          >
                            <Chevron />
                          </summary>
                          <div className="sdx-console-menu">
                            {CONSOLE_PAGES.map((page) => {
                              const current = currentPath === page.href ||
                                currentPath.startsWith(page.href + "/");
                              return (
                                <a
                                  key={page.href}
                                  href={page.href}
                                  aria-current={current ? "page" : undefined}
                                >
                                  {page.label}
                                </a>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    </li>
                  );
                },
              )}
            </ul>
          </div>
        </nav>
      )}
    </div>
  );
}
