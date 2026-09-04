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
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-sm text-gray-500">
        {items.map((item, i) => (
          <span key={`${item.label}:${i}`}>
            {i > 0 && <span className="mx-2">›</span>}
            {item.menu ? (
              <details className="relative inline-block">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-gray-800 font-medium hover:text-[#003366]">
                  {item.label}
                  <CrumbChevron />
                </summary>
                <div className="absolute left-0 top-full mt-1 bg-white shadow-lg rounded border border-gray-200 min-w-[200px] z-50 py-1">
                  {item.menu.map((m) => (
                    <a
                      key={m.href}
                      href={m.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#003366] no-underline"
                    >
                      {m.label}
                    </a>
                  ))}
                </div>
              </details>
            ) : item.href ? (
              <a
                href={item.href}
                className="hover:text-[#003366] hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-gray-800 font-medium">{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
