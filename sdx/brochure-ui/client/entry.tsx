// Client hydration entry point, bundled by scripts/build-client.ts into
// public/js/client.js and loaded on every server-rendered page.
//
// The B.C. Design System's React component library
// (@bcgov/design-system-react-components) injects its own CSS into
// document.head at runtime when a component first mounts in the browser -
// it ships no separate stylesheet. That means any use of a library
// component only looks right once its React tree actually runs client-side.
//
// This app's pages/lib code is written for a server-only Deno runtime (it
// reads files and env vars at module load), so it can't safely be re-run in
// the browser. Rather than hydrate whole pages, this bundle only ever
// imports the design-system library itself (see client/island-registry.tsx)
// and mounts small, independent "islands" into elements marked
// data-bcds-island="<Name>" - each one client-rendered fresh via
// createRoot(), replacing the plain, accessible server-rendered fallback
// that was there until this script ran.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ISLAND_REGISTRY } from "./island-registry.tsx";

function boot() {
  const nodes = document.querySelectorAll<HTMLElement>("[data-bcds-island]");
  for (const el of nodes) {
    const name = el.dataset.bcdsIsland;
    if (!name) continue;
    const Component = ISLAND_REGISTRY[name];
    if (!Component) {
      console.error(`[sdx] No island registered for "${name}"`);
      continue;
    }
    let props: Record<string, unknown> = {};
    const raw = el.dataset.bcdsProps;
    if (raw) {
      try {
        props = JSON.parse(raw);
      } catch (err) {
        console.error(`[sdx] Invalid island props for "${name}"`, err);
      }
    }
    createRoot(el).render(createElement(Component, props));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
