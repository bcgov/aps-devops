export interface Crumb {
  label: string;
  href?: string;
  /** When set, this crumb renders as a "jump to" dropdown of sibling pages. */
  menu?: { label: string; href: string }[];
}

function CrumbChevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="inline-block align-middle"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Standard page breadcrumb bar. Items without an href render as the current page. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-surface-muted border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-sm text-ink-secondary">
        {items.map((item, i) => (
          <span key={`${item.label}:${i}`}>
            {i > 0 && (
              <span className="mx-2" aria-hidden="true">
                ›
              </span>
            )}
            {item.menu ? (
              <details className="relative inline-block">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-ink font-medium hover:text-bc-blue">
                  {item.label}
                  <CrumbChevron />
                </summary>
                <div className="absolute left-0 top-full mt-1 bg-white shadow-lg rounded border border-border min-w-[200px] z-50 py-1">
                  {item.menu.map((m) => (
                    <a
                      key={m.href}
                      href={m.href}
                      className="block px-4 py-2 text-sm text-ink-secondary hover:bg-surface-muted hover:text-bc-blue no-underline"
                    >
                      {m.label}
                    </a>
                  ))}
                </div>
              </details>
            ) : item.href ? (
              <a
                href={item.href}
                className="hover:text-bc-blue hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-ink font-medium">
                {item.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
