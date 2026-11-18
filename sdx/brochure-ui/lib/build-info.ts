/**
 * The image's release version and Git revision, shown in the footer the same
 * way the API Services Portal shows them in its help menu.
 *
 * CI passes both as Docker build args (.github/workflows/.build.yml):
 * APP_VERSION is the release's semver (e.g. "1.4.0") for a tagged release and
 * the commit SHA otherwise; APP_REVISION is always the commit SHA. A local
 * `deno run` has neither.
 */
const SEMVER = /^\d+\.\d+\.\d+$/;

export function buildLabel(
  version = Deno.env.get("APP_VERSION") ?? "",
  revision = Deno.env.get("APP_REVISION") ?? "",
): string {
  const shownVersion = SEMVER.test(version) ? `v${version}` : revision ? "dev" : "local";
  return revision
    ? `Version: ${shownVersion} · Revision: ${revision.slice(0, 9)}`
    : `Version: ${shownVersion}`;
}

export const BUILD_LABEL = buildLabel();
