import type { SessionUser } from "../lib/auth.ts";
import { isConsolePath } from "./ConsoleNav.tsx";

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

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* BC Gov blue banner: logo + title + help/login */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[65px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <a
              href="https://sdx.gov.bc.ca"
              className="flex items-center shrink-0 hover:opacity-90 transition-opacity"
            >
              <img
                src="/public/bc_logo_header.svg"
                alt="Government of British Columbia"
                className="h-10 w-auto"
              />
            </a>
            <a
              href={bannerHref}
              className="text-white font-bold text-xl sm:text-2xl truncate hover:text-blue-200 transition-colors"
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
              className="inline-flex items-center gap-1 px-3 py-4 hover:bg-white/10 transition-colors"
            >
              Help <Chevron />
            </a>

            {authEnabled && user ? (
              <details className="relative group">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 px-3 py-4 hover:bg-white/10 transition-colors">
                  <span className="truncate max-w-[160px]">
                    {displayName}
                  </span>
                  <Chevron />
                </summary>
                <div className="absolute right-0 top-full bg-white text-gray-800 shadow-lg rounded border border-gray-200 min-w-[200px] z-50 py-1">
                  {user.email && (
                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 truncate">
                      {user.email}
                    </div>
                  )}
                  <a
                    href="/auth/logout"
                    className="block px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Logout
                  </a>
                </div>
              </details>
            ) : (
              <a
                href={`/auth/login?returnTo=${encodeURIComponent(currentPath)}`}
                className="inline-flex items-center gap-1 px-3 py-4 hover:bg-white/10 transition-colors"
              >
                Login <Chevron />
              </a>
            )}
          </nav>
        </div>
      </div>

      {/* Gold accent line */}
      <div className="h-[3px] bg-[#FCBA19]" />

      {/* Secondary white nav bar */}
      {!hideMainNav && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav
              className="flex flex-wrap gap-0"
              aria-label="Main navigation"
            >
              {NAV_ITEMS.filter(
                (item) => !item.authRequired || user,
              ).map((item) => {
                const isActive =
                  item.href === "/console"
                    ? isConsolePath(currentPath)
                    : currentPath === item.href ||
                      (item.href !== "/" &&
                        currentPath.startsWith(
                          item.href + "/",
                        ));
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={[
                      "px-4 py-4 text-sm font-medium border-b-[3px] transition-colors",
                      isActive
                        ? "border-[#FCBA19] text-[#003366]"
                        : "border-transparent text-gray-600 hover:text-[#003366] hover:border-gray-300",
                    ].join(" ")}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
