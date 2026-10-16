// Client-only rendering of the real B.C. Design System Header + Subheader.
// Mounted by client/entry.tsx into the <header data-bcds-island="AppChrome">
// element that components/Nav.tsx renders server-side (with a plain
// accessible HTML fallback as that element's children, used until this
// script loads and replaces it). This file is bundled by
// scripts/build-client.ts and must never import anything from lib/ or
// pages/ - only the design-system library and plain data.
import { Header, Subheader } from "@bcgov/design-system-react-components";
// ConsoleNav.tsx is pure data/logic (no Deno-only I/O), safe to bundle for
// the browser - it's the same active-path check components/Nav.tsx uses.
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
      <Header
        title={bannerTitle}
        logoLinkElement={<a href={bannerHref} />}
        skipLinks={[<a href="#main-content">Skip to main content</a>]}
      >
        <a
          href={helpUrl}
          aria-current={currentPath === "/help" ? "page" : undefined}
        >
          Help
        </a>
        {isLoggedIn
          ? (
            <details>
              <summary>{userDisplayName}</summary>
              {userEmail && <div>{userEmail}</div>}
              <a href={logoutHref}>Logout</a>
            </details>
          )
          : <a href={loginHref}>Login</a>}
      </Header>
      {!hideMainNav && (
        <Subheader ariaLabel="Main navigation">
          {navItems.map((item) => {
            const isActive = item.href === "/console"
              ? isConsolePath(currentPath)
              : currentPath === item.href ||
                (item.href !== "/" && currentPath.startsWith(item.href + "/"));
            if (item.href === "/console" && consolePages.length > 0) {
              return (
                <span key={item.href}>
                  <a
                    href="/console"
                    aria-current={currentPath === "/console" ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                  <details>
                    <summary aria-label="Member Console sections">▾</summary>
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
                  </details>
                </span>
              );
            }
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </Subheader>
      )}
    </>
  );
}
