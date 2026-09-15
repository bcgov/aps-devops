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
        <link
          href="/public/css/BC_Sans.css"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,300;0,400;0,700;1,400&display=swap"
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
                      sans: ['BC Sans', 'Courier New', 'Noto Sans', 'Arial', 'sans-serif'],
                    },
                    // Align the body text scale with the BC Government Design
                    // System (BC Sans): body = 16px, body-large = 18px, small/
                    // caption = 14px (the readability floor). Headings
                    // (lg/xl/2xl+) keep their Tailwind defaults. [size, lineHeight].
                    fontSize: {
                      xs: ['0.875rem', '1.25rem'],    // 14px — small / caption
                      sm: ['1rem', '1.5rem'],         // 16px — body
                      base: ['1.125rem', '1.75rem'],  // 18px — body large
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
          .sdx-prose p { margin-bottom: 0.75em; }
          .sdx-prose p:last-child { margin-bottom: 0; }
          .sdx-prose a { color: #003366; text-decoration: underline; }
          .sdx-prose a:hover { color: #1a5276; }
          .sdx-prose strong { font-weight: 700; }
          .sdx-prose em { font-style: italic; }
          .sdx-prose code { font-family: monospace; background: #f2f2f2; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.85em; }
          .sdx-prose pre { background: #f2f2f2; padding: 1em; border-radius: 6px; overflow-x: auto; margin-bottom: 0.75em; }
          .sdx-prose pre code { background: none; padding: 0; font-size: 0.85em; }
          .sdx-prose ul { list-style: disc; margin-left: 1.5em; margin-bottom: 0.75em; }
          .sdx-prose ol { list-style: decimal; margin-left: 1.5em; margin-bottom: 0.75em; }
          .sdx-prose li { margin-bottom: 0.25em; }
          .sdx-prose h1 { font-size: 1.4em; font-weight: 700; margin: 1em 0 0.5em; }
          .sdx-prose h2 { font-size: 1.2em; font-weight: 700; margin: 1em 0 0.4em; }
          .sdx-prose h3 { font-size: 1.05em; font-weight: 700; margin: 0.75em 0 0.35em; }
          .sdx-prose blockquote { border-left: 3px solid #FCBA19; padding-left: 1em; color: #555; margin-bottom: 0.75em; }
          .sdx-prose hr { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
          .sdx-prose table { border-collapse: collapse; width: 100%; margin-bottom: 0.75em; font-size: 0.9em; }
          .sdx-prose th { background: #f2f2f2; font-weight: 600; text-align: left; padding: 0.4em 0.75em; border: 1px solid #d1d5db; }
          .sdx-prose td { padding: 0.4em 0.75em; border: 1px solid #d1d5db; }
        `,
          }}
        />
      </head>
      <body className="font-sans text-gray-800 bg-white min-h-screen flex flex-col">
        <Nav
          currentPath={currentPath}
          user={user}
          authEnabled={authEnabled}
          hideMainNav={hideMainNav}
          bannerTitle={bannerTitle ?? config.bannerTitle}
          bannerHref={bannerHref}
        />
        <main className="flex-1">{children}</main>
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
