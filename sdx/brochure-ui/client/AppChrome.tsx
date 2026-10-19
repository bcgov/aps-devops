// Client-only rendering of the catalogue header. The server renders the same
// structure as a no-JS fallback (components/Nav.tsx). This island replaces
// that fallback once public/js/client.js loads, so both must stay in step.
// Do not render the design-system Header here: it injects a second
// "Skip to main content" link. This file must not import from lib/ or pages/.
import { isConsolePath } from "../components/custom/ConsoleNav.tsx";

interface ConsolePageLink {
  label: string;
  href: string;
}

export interface AppChromeProps {
  currentPath: string;
  bannerTitle: string;
  bannerHref: string;
  helpUrl: string;
  hideMainNav?: boolean;
  authEnabled?: boolean;
  loginHref?: string;
  logoutHref?: string;
  userDisplayName?: string;
  userEmail?: string;
  navItems: { label: string; href: string }[];
  consolePages?: ConsolePageLink[];
}

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

export function AppChrome({
  currentPath,
  bannerTitle,
  bannerHref,
  helpUrl,
  hideMainNav,
  authEnabled,
  loginHref,
  logoutHref,
  userDisplayName,
  userEmail,
  navItems,
  consolePages = [],
}: AppChromeProps) {
  const isLoggedIn = authEnabled && !!userDisplayName;

  return (
    <>
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
            href={helpUrl}
            aria-current={currentPath === "/help" ? "page" : undefined}
            className="sdx-tool-link"
          >
            Help
          </a>
          {isLoggedIn ? (
            <details className="sdx-account">
              <summary className="sdx-account-summary">
                Account <Chevron />
              </summary>
              <div className="sdx-account-menu">
                {userEmail && <p className="sdx-account-email">{userEmail}</p>}
                <a href={logoutHref}>Logout</a>
              </div>
            </details>
          ) : (
            <a href={loginHref} className="sdx-tool-link">Login</a>
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
              {navItems.map((item) => {
                const isActive = item.href === "/console"
                  ? isConsolePath(currentPath)
                  : currentPath === item.href ||
                    (item.href !== "/" && currentPath.startsWith(item.href + "/"));
                if (item.href !== "/console" || consolePages.length === 0) {
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
                    <div className="sdx-console" data-active={isActive ? "true" : "false"}>
                      <a
                        href="/console"
                        className="sdx-nav-link"
                        aria-current={currentPath === "/console" ? "page" : undefined}
                      >
                        {item.label}
                      </a>
                      <details>
                        <summary className="sdx-console-summary" aria-label="Member Console sections">
                          <Chevron />
                        </summary>
                        <div className="sdx-console-menu">
                          {consolePages.map((page) => {
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
              })}
            </ul>
          </div>
        </nav>
      )}
    </>
  );
}
