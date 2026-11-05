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
          /* Focus: blue on light surfaces, white where the ring sits on a dark surface. */
          :focus-visible {
            outline: 2px solid var(--surface-color-border-active);
            outline-offset: 2px;
          }
          .sdx-on-dark :focus-visible,
          .bg-bc-blue :focus-visible,
          .bg-bc-blue:focus-visible {
            outline-color: #fff;
          }
          /* Inset the accordion header ring so a parent border or overflow does not clip it. */
          summary:focus-visible {
            outline-offset: -3px;
          }
          summary.bg-bc-blue:focus-visible {
            outline: 2px solid #fff;
            outline-offset: -4px;
          }
          @media (forced-colors: active) {
            :focus-visible,
            summary:focus-visible {
              outline: 2px solid Highlight;
              outline-offset: 2px;
            }
          }
          .sdx-chrome { background: #fff; }
          .sdx-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem 1.5rem;
            max-width: 80rem;
            margin: 0 auto;
            padding: 0.75rem 1.5rem;
            background: #fff;
            border-bottom: 1px solid var(--surface-color-border-default);
            position: sticky;
            top: 0;
            z-index: 40;
          }
          .sdx-brand { display: flex; align-items: center; gap: 1rem; min-width: 0; }
          .sdx-logo { display: flex; align-items: center; flex-shrink: 0; }
          .sdx-logo img { height: 2.25rem; width: auto; }
          .sdx-brand-rule { width: 1px; align-self: stretch; background: var(--surface-color-border-default); }
          .sdx-title {
            color: var(--theme-primary-blue);
            font-weight: 700;
            font-size: 1.25rem;
            line-height: 1.3;
            text-decoration: none;
            min-width: 0;
          }
          .sdx-title:hover { color: var(--surface-color-primary-hover); }
          .sdx-tools { display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0; }
          .sdx-tool-link, .sdx-account-summary, .sdx-menu-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.5rem 0.75rem;
            border-radius: var(--layout-border-radius-small);
            color: var(--typography-color-secondary);
            background: transparent;
            border: 0;
            font: inherit;
            font-size: 0.875rem;
            text-decoration: none;
            cursor: pointer;
          }
          .sdx-tool-link:hover, .sdx-account-summary:hover, .sdx-menu-btn:hover {
            color: var(--theme-primary-blue);
            background: var(--surface-color-background-light-gray);
          }
          .sdx-account { position: relative; }
          .sdx-account-summary { list-style: none; align-items: center; }
          .sdx-account-summary::-webkit-details-marker { display: none; }
          .sdx-account-menu {
            position: absolute;
            right: 0;
            top: 100%;
            z-index: 60;
            background: #fff;
            color: var(--typography-color-primary);
            border: 1px solid var(--surface-color-border-default);
            border-radius: var(--layout-border-radius-medium);
            box-shadow: var(--surface-shadow-medium);
            width: max-content;
            max-width: calc(100vw - 1.5rem);
            padding: 0.25rem 0;
          }
          .sdx-account-email {
            margin: 0;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            color: var(--typography-color-secondary);
            white-space: nowrap;
            border-bottom: 1px solid var(--surface-color-border-default);
          }
          .sdx-account-menu a {
            display: block;
            padding: 0.5rem 1rem;
            color: var(--typography-color-primary);
            text-decoration: none;
            font-size: 0.875rem;
          }
          .sdx-account-menu a:hover { background: var(--surface-color-background-light-gray); }
          .sdx-menu-btn {
            display: none;
            margin-left: auto;
            border: 1px solid var(--surface-color-border-dark);
            background: #fff;
            color: var(--typography-color-primary);
            gap: 0.5rem;
          }
          .sdx-main-nav {
            background: #fff;
            border-bottom: 1px solid var(--surface-color-border-default);
          }
          .sdx-main-nav-inner { max-width: 80rem; margin: 0 auto; padding: 0 1.5rem; }
          .sdx-main-nav ul { display: flex; flex-wrap: wrap; list-style: none; margin: 0; padding: 0; }
          .sdx-main-nav li + li { border-left: 1px solid var(--surface-color-border-default); }
          .sdx-nav-link {
            display: block;
            padding: 0.75rem 1rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--typography-color-secondary);
            text-decoration: none;
          }
          .sdx-nav-link:hover { color: var(--theme-primary-blue); background: var(--surface-color-background-light-gray); }
          .sdx-nav-link[aria-current="page"] { color: var(--theme-primary-blue); font-weight: 600; }
          .sdx-console { display: flex; align-items: center; }
          .sdx-console-summary {
            list-style: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            align-self: stretch;
            padding: 0 0.5rem;
            color: var(--typography-color-secondary);
          }
          .sdx-console-summary::-webkit-details-marker { display: none; }
          .sdx-console[data-active="true"] .sdx-console-summary { color: var(--theme-primary-blue); }
          .sdx-console-menu {
            position: absolute;
            left: 0;
            top: 100%;
            z-index: 60;
            background: #fff;
            border: 1px solid var(--surface-color-border-default);
            border-radius: var(--layout-border-radius-medium);
            box-shadow: var(--surface-shadow-medium);
            min-width: 14rem;
            padding: 0.25rem 0;
          }
          .sdx-console { position: relative; }
          .sdx-console-menu a {
            display: block;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            color: var(--typography-color-primary);
            text-decoration: none;
          }
          .sdx-console-menu a:hover,
          .sdx-console-menu a[aria-current="page"] {
            background: var(--surface-color-background-light-gray);
            color: var(--theme-primary-blue);
          }
          .sdx-console-menu a[aria-current="page"] { font-weight: 600; }
          @media (max-width: 799px) {
            html, body { overflow-x: clip; }
            .sdx-header { flex-wrap: wrap; align-items: flex-start; gap: 0.75rem 1rem; padding: 0.75rem 1rem; }
            .sdx-brand { width: 100%; }
            .sdx-brand-rule { display: none; }
            .sdx-title { white-space: normal; overflow-wrap: anywhere; font-size: 1.125rem; }
            .sdx-tools { width: 100%; }
            .sdx-menu-btn { display: inline-flex; }
            .sdx-account { position: static; }
            .sdx-account-menu {
              left: 0;
              right: 0;
              width: auto;
              max-width: none;
              border-radius: 0;
              box-shadow: none;
            }
            .sdx-account-email { white-space: normal; overflow-wrap: anywhere; }
            .sdx-main-nav { display: none; }
            .sdx-main-nav.is-open { display: block; }
            .sdx-main-nav ul { flex-direction: column; }
            .sdx-main-nav li + li { border-left: 0; border-top: 1px solid var(--surface-color-border-default); }
            .sdx-main-nav-inner { padding: 0; }
            .sdx-console { display: grid; grid-template-columns: 1fr auto; align-items: center; width: 100%; }
            .sdx-console > a { grid-column: 1; grid-row: 1; }
            .sdx-console details { display: contents; }
            .sdx-console-summary { grid-column: 2; grid-row: 1; }
            .sdx-console-menu {
              position: static;
              grid-column: 1 / -1;
              grid-row: 2;
              width: 100%;
              box-shadow: none;
              border: 0;
              border-radius: 0;
              min-width: 0;
            }
            .sdx-console-menu a { padding-left: 1rem; }
          }
          @media (min-width: 800px) {
            .sdx-main-nav { display: block; }
            .sdx-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          }
          /* Button anatomy requires a border stroke on every variant, even
             filled ones — applied globally so every bg-btn-primary/
             bg-btn-danger call site gets it for free. */
          .bg-btn-primary { border: 1px solid var(--surface-color-primary-button-default); }
          .bg-btn-primary:hover { border-color: var(--surface-color-primary-button-hover); }
          .bg-btn-danger { border: 1px solid var(--surface-color-primary-danger-button-default); }
          .bg-btn-danger:hover { border-color: var(--surface-color-primary-danger-button-hover); }
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
        <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
        <Footer />
        {/* Mounts the real B.C. Design System Header/Footer (client/
            entry.tsx) into the data-bcds-island elements above - see the
            comment on Nav.tsx's <header>. */}
        <script type="module" src="/public/js/client.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          var MENU_ICON = '<path d="M1 3h14M1 8h14M1 13h14" stroke="currentColor" stroke-width="1.5"/>';
          var CLOSE_ICON = '<path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5"/>';
          function menuButton() { return document.querySelector('.sdx-menu-btn'); }
          function closeDetails(el) { if (el && el.open) el.open = false; }
          function closeAccount() { closeDetails(document.querySelector('.sdx-account')); }
          function closeConsole() {
            document.querySelectorAll('.sdx-console details').forEach(function (el) { closeDetails(el); });
          }
          function setMainMenu(open) {
            var nav = document.getElementById('sdx-main-menu');
            var btn = menuButton();
            if (!nav || !btn) return;
            nav.classList.toggle('is-open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            var label = btn.querySelector('.sdx-menu-label');
            var icon = btn.querySelector('.sdx-menu-icon');
            if (label) label.textContent = open ? 'Close menu' : 'Menu';
            if (icon) icon.innerHTML = open ? CLOSE_ICON : MENU_ICON;
            if (open) closeAccount();
          }
          document.addEventListener('toggle', function (e) {
            var el = e.target;
            if (!el || el.tagName !== 'DETAILS' || !el.open) return;
            if (el.classList.contains('sdx-account')) {
              closeConsole();
              setMainMenu(false);
            } else if (el.closest && el.closest('.sdx-console')) {
              closeAccount();
              document.querySelectorAll('.sdx-console details').forEach(function (other) {
                if (other !== el) closeDetails(other);
              });
            }
          }, true);
          document.addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.sdx-menu-btn');
            if (btn) {
              var nav = document.getElementById('sdx-main-menu');
              setMainMenu(!(nav && nav.classList.contains('is-open')));
              return;
            }
            var link = e.target.closest && e.target.closest('a');
            if (link && link.closest('#sdx-main-menu, .sdx-account-menu, .sdx-console-menu')) {
              setMainMenu(false);
              closeAccount();
              closeConsole();
              return;
            }
            if (!e.target.closest('.sdx-account, .sdx-console')) {
              closeAccount();
              closeConsole();
            }
          });
          document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var account = document.querySelector('.sdx-account');
            if (account && account.open) {
              closeDetails(account);
              var summary = account.querySelector('summary');
              if (summary) summary.focus();
              return;
            }
            var section = document.querySelector('.sdx-console details[open]');
            if (section) {
              closeDetails(section);
              var sectionSummary = section.querySelector('summary');
              if (sectionSummary) sectionSummary.focus();
              return;
            }
            var nav = document.getElementById('sdx-main-menu');
            if (nav && nav.classList.contains('is-open')) {
              setMainMenu(false);
              var btn = menuButton();
              if (btn) btn.focus();
            }
          });
        `,
          }}
        />
        <div
          id="sdx-copy-status"
          role="status"
          aria-live="polite"
          className="sr-only"
        />
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
              btn.classList.remove('text-ink-placeholder');
              btn.classList.add('text-support-success-border');
              var previousLabel = btn.getAttribute('aria-label') || 'Copy to clipboard';
              btn.setAttribute('aria-label', 'Copied to clipboard');
              var status = document.getElementById('sdx-copy-status');
              if (status) {
                status.textContent = '';
                setTimeout(function () { status.textContent = 'Copied to clipboard'; }, 50);
              }
              setTimeout(function () {
                svg.innerHTML = CLIP_ICON;
                btn.classList.remove('text-support-success-border');
                btn.classList.add('text-ink-placeholder');
                btn.setAttribute('aria-label', previousLabel);
                if (status) status.textContent = '';
              }, 1800);
            });
          });
        `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          function syncDialogScroll() {
            var open = document.querySelector('dialog[open]');
            document.documentElement.style.overflow = open ? 'hidden' : '';
            document.body.style.overflow = open ? 'hidden' : '';
          }
          new MutationObserver(syncDialogScroll).observe(document.documentElement, {
            subtree: true,
            attributes: true,
            attributeFilter: ['open']
          });
          syncDialogScroll();
        `,
          }}
        />
      </body>
    </html>
  );
}
