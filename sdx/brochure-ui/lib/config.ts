import { parse } from "@std/yaml";
import type { SiteConfig } from "../types.ts";

const configText = await Deno.readTextFile(
  new URL("../config.yaml", import.meta.url),
);
export const config = parse(configText) as SiteConfig;
