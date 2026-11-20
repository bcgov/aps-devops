import type { JwkRecord } from "../types.ts";

/** Select an exact SDX identity and environment from an aggregate registry. */
export function keysForKeyset(
  keys: JwkRecord[],
  prefix: string,
  environment: string,
): JwkRecord[] {
  const identity = prefix.replace(/^sdx\.(org|sys)\./, "$1:");
  const kidPrefix = `urn:ca:bc:sdx:${identity}:${environment}:`.toLowerCase();
  return keys.filter((key) =>
    typeof key.kid === "string" &&
    key.kid.toLowerCase().startsWith(kidPrefix)
  );
}
