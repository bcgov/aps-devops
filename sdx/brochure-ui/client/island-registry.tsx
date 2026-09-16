// Maps the data-bcds-island name on a mount element to the client component
// that replaces its server-rendered fallback content once this bundle loads.
// Add an entry here whenever a new B.C. Design System component is adopted
// somewhere in the app - see client/AppChrome.tsx for the constraints.
import type { ComponentType } from "react";
import { AppChrome } from "./AppChrome.tsx";
import { AppFooter } from "./AppFooter.tsx";

// deno-lint-ignore no-explicit-any
export const ISLAND_REGISTRY: Record<string, ComponentType<any>> = {
  AppChrome,
  AppFooter,
};
