import { Nav } from "./Nav.tsx";
import { Footer } from "./Footer.tsx";
import { config } from "../lib/config.ts";
import {
  authEnabled,
  type SessionUser,
} from "../lib/auth.ts";

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  currentPath: string;
  user?: SessionUser | null;
  hideMainNav?: boolean;
  bannerTitle?: string;
  bannerHref?: string;
}

export function Layout({
  title,
  children,
  currentPath,
  user,
  hideMainNav,
  bannerTitle,
  bannerHref,
}: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>{`${title} | BC SDX Catalogue`}</title>
        {/* BC Sans font (required by the B.C. Design System) and the
            official B.C. Design Tokens (@bcgov/design-tokens), vendored as
            plain CSS custom properties in public/css/design-tokens.css. */}
        <link
          href="/public/css/BC_Sans.css"
          rel="stylesheet"
        />
        <link
          href="/public/css/design-tokens.css"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    fontFamily: {
                      sans: ['BC Sans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'],
                    },
                    // Text scale sourced from the B.C. Design Tokens
                    // (--typography-font-size-* / --typography-line-heights-*).
                    // Mapped 1:1 onto Tailwind's default size scale so every
                    // text-* utility in the app resolves to a design-system size.
                    fontSize: {
                      xs: ['0.75rem', '1.125rem'],    // 12px — label / caption
                      sm: ['0.875rem', '1.313rem'],   // 14px — small body
                      base: ['1rem', '1.688rem'],     // 16px — body (default)
                      lg: ['1.125rem', '1.913rem'],   // 18px — large body / h6
                      xl: ['1.25rem', '2.125rem'],    // 20px — h5
                      '2xl': ['1.5rem', '2.25rem'],   // 24px — h4
                      '3xl': ['1.75rem', '3rem'],     // 28px — h3
                      '4xl': ['2rem', '3rem'],        // 32px — h2
                      '5xl': ['2.25rem', '3.375rem'], // 36px — h1
                      '6xl': ['3rem', '1'],           // 48px — display
                    },
                    // Colors resolve to CSS custom properties from
                    // design-tokens.css, so values stay in sync with the
                    // design system without hardcoding hex codes in JSX.
                    colors: {
                      'bc-blue': 'var(--theme-primary-blue)',
                      'bc-blue-hover': 'var(--surface-color-primary-hover)',
                      'bc-blue-pressed': 'var(--surface-color-primary-pressed)',
                      'bc-blue-dark': 'var(--surface-color-background-dark-blue)',
                      'bc-gold': 'var(--theme-primary-gold)',
                      ink: 'var(--typography-color-primary)',
                      'ink-secondary': 'var(--typography-color-secondary)',
                      'ink-placeholder': 'var(--typography-color-placeholder)',
                      'ink-disabled': 'var(--typography-color-disabled)',
                      'ink-invert': 'var(--typography-color-primary-invert)',
                      'ink-invert-secondary': 'var(--typography-color-secondary-invert)',
                      link: 'var(--typography-color-link)',
                      danger: 'var(--typography-color-danger)',
                      surface: 'var(--surface-color-background-white)',
                      'surface-muted': 'var(--surface-color-background-light-gray)',
                      'surface-blue-tint': 'var(--surface-color-background-light-blue)',
                      border: 'var(--surface-color-border-default)',
                      'border-medium': 'var(--surface-color-border-medium)',
                      'border-dark': 'var(--surface-color-border-dark)',
                      'border-active': 'var(--surface-color-border-active)',
                      'btn-primary': 'var(--surface-color-primary-button-default)',
                      'btn-primary-hover': 'var(--surface-color-primary-button-hover)',
                      'btn-secondary': 'var(--surface-color-secondary-button-default)',
                      'btn-secondary-hover': 'var(--surface-color-secondary-button-hover)',
                      'btn-tertiary-hover': 'var(--surface-color-tertiary-button-hover)',
                      'btn-danger': 'var(--surface-color-primary-danger-button-default)',
                      'btn-danger-hover': 'var(--surface-color-primary-danger-button-hover)',
                      'support-info-bg': 'var(--support-surface-color-info)',
                      'support-info-border': 'var(--support-border-color-info)',
                      'support-success-bg': 'var(--support-surface-color-success)',
                      'support-success-border': 'var(--support-border-color-success)',
                      'support-warning-bg': 'var(--support-surface-color-warning)',
                      'support-warning-border': 'var(--support-border-color-warning)',
                      'support-danger-bg': 'var(--support-surface-color-danger)',
                      'support-danger-border': 'var(--support-border-color-danger)',
                    },
                    borderRadius: {
                      none: 'var(--layout-border-radius-none)',
                      sm: 'var(--layout-border-radius-small)',
                      DEFAULT: 'var(--layout-border-radius-medium)',
                      md: 'var(--layout-border-radius-medium)',
                      lg: 'var(--layout-border-radius-large)',
                      full: 'var(--layout-border-radius-circular)',
                    },
                    boxShadow: {
                      none: 'var(--surface-shadow-none)',
                      sm: 'var(--surface-shadow-small)',
                      DEFAULT: 'var(--surface-shadow-small)',
                      md: 'var(--surface-shadow-medium)',
                      lg: 'var(--surface-shadow-large)',
                    },
                  },
                },
              };
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          /* B.C. Design System focus indicator (2px active-blue outline). */
          :focus-visible {
            outline: 2px solid var(--surface-color-border-active);
            outline-offset: 2px;
          }
          .sdx-prose p { margin-bottom: 0.75em; }
          .sdx-prose p:last-child { margin-bottom: 0; }
          .sdx-prose a { color: var(--typography-color-link); text-decoration: underline; }
          .sdx-prose a:hover { color: var(--surface-color-primary-hover); }
          .sdx-prose strong { font-weight: 700; }
          .sdx-prose em { font-style: italic; }
          .sdx-prose code { font-family: monospace; background: var(--surface-color-background-light-gray); padding: 0.1em 0.35em; border-radius: var(--layout-border-radius-small); font-size: 0.85em; }
          .sdx-prose pre { background: var(--surface-color-background-light-gray); padding: 1em; border-radius: var(--layout-border-radius-medium); overflow-x: auto; margin-bottom: 0.75em; }
          .sdx-prose pre code { background: none; padding: 0; font-size: 0.85em; }
          .sdx-prose ul { list-style: disc; margin-left: 1.5em; margin-bottom: 0.75em; }
          .sdx-prose ol { list-style: decimal; margin-left: 1.5em; margin-bottom: 0.75em; }
          .sdx-prose li { margin-bottom: 0.25em; }
          .sdx-prose h1 { font-size: 1.4em; font-weight: 700; margin: 1em 0 0.5em; }
          .sdx-prose h2 { font-size: 1.2em; font-weight: 700; margin: 1em 0 0.4em; }
          .sdx-prose h3 { font-size: 1.05em; font-weight: 700; margin: 0.75em 0 0.35em; }
          .sdx-prose blockquote { border-left: 3px solid var(--theme-primary-gold); padding-left: 1em; color: var(--typography-color-secondary); margin-bottom: 0.75em; }
          .sdx-prose hr { border: none; border-top: 1px solid var(--surface-color-border-default); margin: 1em 0; }
          .sdx-prose table { border-collapse: collapse; width: 100%; margin-bottom: 0.75em; font-size: 0.9em; }
          .sdx-prose th { background: var(--surface-color-background-light-gray); font-weight: 600; text-align: left; padding: 0.4em 0.75em; border: 1px solid var(--surface-color-border-default); }
          .sdx-prose td { padding: 0.4em 0.75em; border: 1px solid var(--surface-color-border-default); }
        `,
          }}
        />
      </head>
      <body className="font-sans text-ink bg-white min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-bc-blue focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:font-medium"
        >
          Skip to main content
        </a>
        <Nav
          currentPath={currentPath}
          user={user}
          authEnabled={authEnabled}
          hideMainNav={hideMainNav}
          bannerTitle={bannerTitle ?? config.bannerTitle}
          bannerHref={bannerHref}
        />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          var CLIP_ICON = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
          var CHECK_ICON = '<polyline points="20 6 9 17 4 12"/>';
          document.addEventListener('click', function (e) {
            var btn = e.target.closest('.sdx-copy-btn[data-copy]');
            if (!btn) return;
            navigator.clipboard.writeText(btn.dataset.copy).then(function () {
              var svg = btn.querySelector('svg');
              svg.innerHTML = CHECK_ICON;
              btn.classList.add('text-green-500');
              btn.classList.remove('text-gray-300');
              setTimeout(function () {
                svg.innerHTML = CLIP_ICON;
                btn.classList.remove('text-green-500');
                btn.classList.add('text-gray-300');
              }, 1800);
            });
          });
        `,
          }}
        />
      </body>
    </html>
  );
}
