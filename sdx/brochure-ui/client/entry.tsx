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
//
// IMPORTANT constraint this discovered the hard way: createRoot(el).render()
// throws away and rebuilds el's entire subtree as new DOM nodes - it does
// NOT mutate the fallback's existing elements in place. Any other script on
// the page that captures a reference to an element *inside* an island's
// fallback (via getElementById/querySelector, run before this script mounts
// the island) will hold a stale, now-detached node once the island replaces
// it - its event listeners and reads/writes silently stop affecting what's
// on screen. This is why components/custom/OrgPicker.tsx still uses a plain
// native <select> instead of the real Select: its pin-organization script
// looks up the select by CSS selector, and converting it broke that lookup
// (confirmed via a real interaction test, not just theory) with no fix
// short of moving that script's logic into the island itself. Before
// converting anything else, check whether any *other* script on the page
// references an element inside its fallback by id/selector - if so, either
// move that logic into the island component too, or leave it unconverted.
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
